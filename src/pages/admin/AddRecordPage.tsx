import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { HttpError, extractErrorMessage } from "../../app/lib/httpClient";
import { createRecordService } from "../../app/services/recordService";
import { useDiscogsSearch } from "../../app/hooks/useDiscogsSearch";
import type { DiscogsSearchResult } from "../../app/services/discogsService";
import type { Artist, Category, Genere, Owner, Record as AlbumRecord, RecordOwnerStock } from "../../app/domain/album";
import { Img } from "../../components/Img";
import { DeleteArtistDialog } from "./DeleteArtistDialog";
import { CatalogPicker, DeleteCatalogTermDialog, type CatalogTerm } from "./CatalogPicker";
import { normName } from "../../app/lib/text";

/* ── Types ── */

type RecordForm = {
  title: string;
  artist_id: string;
  artist_text: string;
  description: string;
  condition: string;
  /** Genre ids; a record can be in several. */
  generes: string[];
  price: string;
  cost_price: string;
  stock: string;
  cover_image_url: string;
  images: string[];
  discount: string;
  release_year: string;
  items_inside: string;
  weight_grams: string;
  category_id: string;
  /** Whose units the stock is; quantities only matter with several owners. */
  owners: OwnerRow[];
  featured: boolean;
};

type OwnerRow = { owner_id: string; quantity: string };

const INITIAL_FORM: RecordForm = {
  title: "",
  artist_id: "",
  artist_text: "",
  description: "",
  condition: "",
  generes: [],
  price: "",
  cost_price: "",
  stock: "",
  cover_image_url: "",
  images: [],
  discount: "",
  release_year: "",
  items_inside: "1",
  weight_grams: "",
  category_id: "",
  owners: [],
  featured: true,
};

/* Owner <select> value that opens the inline "new owner" fields */
const NEW_OWNER = "__new__";

const CONDITIONS = [
  { value: "M", label: "Mint" },
  { value: "NM", label: "Near Mint" },
  { value: "NM-", label: "Near Mint Minus" },
  { value: "VG+", label: "Very Good Plus" },
  { value: "VG", label: "Very Good" },
  { value: "G", label: "Good" },
  { value: "F", label: "Fair" },
  { value: "P", label: "Poor" },
];

const inputClass =
  "mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30";

/* Try to match Discogs format/genre to our categories */
function matchCategory(
  formats: string[],
  genres: string[],
  styles: string[],
  categories: Category[]
): string {
  const allTerms = [
    ...formats,
    ...genres,
    ...styles,
  ].map((s) => s.toLowerCase());

  // Direct match: look for format names that match category names
  for (const cat of categories) {
    const catLower = cat.name.toLowerCase();
    if (allTerms.some((t) => t.includes(catLower) || catLower.includes(t))) {
      return String(cat.id);
    }
  }

  // Heuristic: vinyl/record → first category, CD → look for cd category
  if (allTerms.some((t) => t.includes("vinyl") || t.includes("record") || t.includes("lp"))) {
    const vinyl = categories.find((c) => /vinyl|lp|disco/i.test(c.name));
    if (vinyl) return String(vinyl.id);
  }
  if (allTerms.some((t) => t.includes("cd"))) {
    const cd = categories.find((c) => /cd/i.test(c.name));
    if (cd) return String(cd.id);
  }
  if (allTerms.some((t) => t.includes("7\"") || t.includes("single") || t.includes("45"))) {
    const single = categories.find((c) => /single|7|sencillo/i.test(c.name));
    if (single) return String(single.id);
  }

  return "";
}

/* ── Props ── */

type AddRecordPageProps = {
  editingRecord?: {
    id: string;
    title: string;
    description?: string;
    condition: string;
    cover_image_url?: string;
    price?: number | string;
    cost_price?: number | string;
    sell_price?: number | string;
    final_sale_price?: number | string | null;
    stock: number;
    images?: string[];
    discount_porcentage?: number;
    release_date?: string | number;
    featured?: boolean;
    items_inside?: number;
    weight_grams?: number | null;
    artist?: { id: string; name: string } | null;
    generes?: { id: string | number; name: string }[];
    category?: { id: string; name: string } | null;
    owners?: RecordOwnerStock[];
    slug?: string;
  } | null;
  onEditDone?: () => void;
};

/* ── Component ── */

export function AddRecordPage({ editingRecord, onEditDone }: AddRecordPageProps = {}) {
  const { token, hasPerm } = useAuth();
  const canDeleteArtist = hasPerm("apiApp.delete_artist");
  const [artistToDelete, setArtistToDelete] = useState<Pick<Artist, "id" | "name"> | null>(null);
  const recordService = useMemo(
    () => createRecordService({ getToken: () => token }),
    [token]
  );
  const {
    searching,
    search: searchDiscogsApi,
    getReleaseDetail,
  } = useDiscogsSearch({ token });

  // An existing record picked from the "ya existe" suggestions: the add form
  // turns into its editor, so stock/owners are added there instead of a duplicate.
  const [adopted, setAdopted] = useState<AlbumRecord | null>(null);
  const [matches, setMatches] = useState<AlbumRecord[]>([]);
  const current: AddRecordPageProps["editingRecord"] = editingRecord ?? adopted;
  const isEditing = Boolean(current);

  // Discogs search
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<DiscogsSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Artist autocomplete
  const [artistSuggestions, setArtistSuggestions] = useState<Artist[]>([]);
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);
  const artistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artistContainerRef = useRef<HTMLDivElement>(null);

  // DB options
  const [generes, setGeneres] = useState<Genere[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Format/genre picked for deletion from a picker (null = no dialog).
  const [termToDelete, setTermToDelete] = useState<{ kind: "format" | "genre"; term: CatalogTerm } | null>(null);
  // Genres + styles of the picked Discogs release: the ones we lack become "+ Crear" suggestions.
  const [discogsGenreNames, setDiscogsGenreNames] = useState<string[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);

  // Inline "Agregar nuevo dueño" for owner row `row` (null = hidden)
  const [newOwner, setNewOwner] = useState<{ name: string; email: string; row: number } | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [savingOwner, setSavingOwner] = useState(false);

  // Form
  const [form, setForm] = useState<RecordForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  /* ── Pre-fill form when editing ── */

  useEffect(() => {
    const editingRecord = current;
    if (!editingRecord) return;
    setForm({
      title: editingRecord.title || "",
      artist_id: editingRecord.artist?.id ? String(editingRecord.artist.id) : "",
      artist_text: editingRecord.artist?.name || "",
      description: editingRecord.description || "",
      condition: editingRecord.condition || "M",
      generes: (editingRecord.generes ?? []).map((g) => String(g.id)),
      price: String(editingRecord.price ?? ""),
      cost_price: String(editingRecord.cost_price ?? ""),
      stock: String(editingRecord.stock ?? ""),
      cover_image_url: editingRecord.cover_image_url || "",
      images: editingRecord.images || [],
      discount: String(editingRecord.discount_porcentage ?? ""),
      release_year: editingRecord.release_date ? String(editingRecord.release_date) : "",
      items_inside: String(editingRecord.items_inside ?? "1"),
      weight_grams:
        editingRecord.weight_grams != null
          ? String(editingRecord.weight_grams)
          : "",
      category_id: editingRecord.category?.id ? String(editingRecord.category.id) : "",
      owners: (editingRecord.owners ?? []).map((o) => ({
        owner_id: String(o.owner),
        quantity: String(o.quantity),
      })),
      featured: editingRecord.featured ?? true,
    });
  }, [current]);

  /* ── Submit ── */

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(false);

    // Basic validation
    if (!form.title.trim()) {
      setSubmitError("El título es obligatorio.");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setSubmitError("El precio debe ser mayor a 0.");
      return;
    }
    if (!form.stock || Number(form.stock) < 0) {
      setSubmitError("El stock no puede ser negativo.");
      return;
    }

    if (newOwner) {
      setSubmitError("Guarda o cancela el nuevo dueño antes de guardar el disco.");
      return;
    }
    if (form.owners.some((row) => !row.owner_id)) {
      setSubmitError("Elige el dueño de cada fila o quítala.");
      return;
    }
    if (form.owners.length > 1 && ownersTotal !== Number(form.stock)) {
      setSubmitError(`Las cantidades por dueño suman ${ownersTotal}, pero el stock es ${form.stock}.`);
      return;
    }

    if (!token) {
      setSubmitError("No estás autenticado.");
      return;
    }

    try {
      setSubmitting(true);

      // Ensure artist exists: create if text provided but no ID selected
      let artistId: string | null = form.artist_id || null;
      if (!artistId && form.artist_text.trim()) {
        try {
          const created = await recordService.createArtist(form.artist_text.trim());
          artistId = String(created.id);
        } catch (err) {
          setSubmitError(extractErrorMessage((err as HttpError).data, "Error al crear el artista."));
          return;
        }
      }

      // Build the payload
      const payload = {
        title: form.title.trim(),
        artist: artistId ? Number(artistId) : null,
        description: form.description.trim() || null,
        condition: form.condition || "M",
        generes: form.generes.map(Number),
        cover_image_url: form.cover_image_url.trim() || null,
        price: Number(form.price) || 0,
        cost_price: Number(form.cost_price) || 0,
        discount_porcentage: Number(form.discount) || 0,
        stock: Number(form.stock),
        images: form.images,
        release_date: form.release_year ? Number(form.release_year) : null,
        featured: form.featured,
        items_inside: Number(form.items_inside) || 1,
        weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
        category: form.category_id ? Number(form.category_id) : null,
        // One owner gets the whole stock server-side; several send their split.
        owners: form.owners.map((row) =>
          form.owners.length > 1
            ? { owner: Number(row.owner_id), quantity: Number(row.quantity) || 0 }
            : { owner: Number(row.owner_id) }
        ),
      };

      if (current) {
        try {
          await recordService.update(current.id, payload);
        } catch (err) {
          setSubmitError(extractErrorMessage((err as HttpError).data, "Error al actualizar el disco."));
          return;
        }
        setSubmitSuccess(true);
        setTimeout(() => {
          if (adopted) setAdopted(null);
          else onEditDone?.();
          setForm(INITIAL_FORM);
          setSubmitSuccess(false);
          setResults([]);
          setHasSearched(false);
          setSelectedId(null);
          setDiscogsGenreNames([]);
          setSearchQuery("");
        }, 1500);
      } else {
        try {
          await recordService.create(payload);
        } catch (err) {
          setSubmitError(extractErrorMessage((err as HttpError).data, "Error al guardar el disco."));
          return;
        }

        setSubmitSuccess(true);

        // Reset form after success
        setTimeout(() => {
          setForm(INITIAL_FORM);
          setSubmitSuccess(false);
          setResults([]);
          setHasSearched(false);
          setSelectedId(null);
          setDiscogsGenreNames([]);
          setSearchQuery("");
        }, 2000);
      }
    } catch {
      setSubmitError("Error de red. Verifica tu conexión.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Formats and genres again: names and records_count change on create/rename/delete. */
  const refreshCatalog = useCallback(async () => {
    const [genereData, catData] = await Promise.all([recordService.getGenres(), recordService.getCategories()]);
    setGeneres(genereData);
    setCategories(catData);
  }, [recordService]);

  // Fetch DB options on mount
  useEffect(() => {
    if (!token) return;
    Promise.all([
      recordService.getGenres().catch(() => []),
      recordService.getCategories().catch(() => []),
      recordService.getOwners().catch(() => []),
    ]).then(([genereData, catData, ownerData]) => {
      setGeneres(genereData ?? []);
      setCategories(catData ?? []);
      setOwners(ownerData ?? []);
    });
  }, [recordService, token]);

  // Close artist dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        artistContainerRef.current &&
        !artistContainerRef.current.contains(e.target as Node)
      ) {
        setShowArtistDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateField = <K extends keyof RecordForm>(
    key: K,
    value: RecordForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* ── Owner rows ── */

  const ownersTotal = form.owners.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const stockCount = Number(form.stock) || 0;
  // Shown when the admin tries to assign more copies (or owners) than the stock has.
  const [ownerLimit, setOwnerLimit] = useState<string | null>(null);

  /** An owner's quantity, capped so all owners together never exceed the stock. */
  const setOwnerQuantity = (index: number, value: string) => {
    const others = form.owners.reduce(
      (sum, row, i) => (i === index ? sum : sum + (Number(row.quantity) || 0)),
      0
    );
    const max = Math.max(0, stockCount - others);
    if (value !== "" && Number(value) > max) {
      setOwnerLimit(
        `El stock es ${stockCount} y los demás dueños ya tienen ${others}: a este le caben como máximo ${max}.`
      );
      updateOwnerRow(index, { quantity: String(max) });
      return;
    }
    setOwnerLimit(null);
    updateOwnerRow(index, { quantity: value });
  };

  const updateOwnerRow = (index: number, changes: Partial<OwnerRow>) =>
    setForm((prev) => ({
      ...prev,
      owners: prev.owners.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    }));

  // Every owner needs at least one copy, so there can't be more owners than
  // stock (one owner is fine with stock 0: a sold-out record keeps its owner).
  const addOwnerRow = () => {
    if (form.owners.length >= Math.max(stockCount, 1)) {
      setOwnerLimit(
        `Con stock ${stockCount} no caben más dueños: cada uno necesita al menos una copia. Sube el stock primero.`
      );
      return;
    }
    setOwnerLimit(null);
    setForm((prev) => {
      // Going from one owner to two: the first keeps all but one copy, the new one gets it.
      const owners = prev.owners.map((row) =>
        prev.owners.length === 1 ? { ...row, quantity: String(stockCount - 1) } : row
      );
      const assigned = owners.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
      return {
        ...prev,
        owners: [...owners, { owner_id: "", quantity: String(Math.max(0, stockCount - assigned)) }],
      };
    });
  };

  const removeOwnerRow = (index: number) => {
    setOwnerLimit(null);
    setForm((prev) => ({ ...prev, owners: prev.owners.filter((_, i) => i !== index) }));
  };

  /* ── "Ya existe": same title (+ artist) as a record in the catalog ── */

  useEffect(() => {
    if (isEditing || !token) return;
    const title = form.title.trim();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!title) {
        setMatches([]);
        return;
      }
      recordService
        .findMatches(title, form.artist_text.trim())
        .then((found) => !cancelled && setMatches(found))
        .catch(() => !cancelled && setMatches([]));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.title, form.artist_text, isEditing, recordService, token]);

  const adoptMatch = async (id: string | number) => {
    setSubmitError(null);
    try {
      setAdopted(await recordService.getForEdit(id));
      setMatches([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(extractErrorMessage(err, "No se pudo abrir el disco para editar."));
    }
  };

  const cancelAdopted = () => {
    setAdopted(null);
    setDiscogsGenreNames([]);
    setNewOwner(null);
    setForm(INITIAL_FORM);
  };

  /* ── Inline owner creation (auto-selected once saved) ── */

  const saveOwner = async () => {
    if (!newOwner) return;
    const name = newOwner.name.trim();
    const email = newOwner.email.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      setOwnerError("Escribe el nombre y un correo válido.");
      return;
    }
    setSavingOwner(true);
    setOwnerError(null);
    try {
      const owner = await recordService.createOwner({ name, email });
      setOwners((prev) => [...prev, owner].sort((a, b) => a.name.localeCompare(b.name)));
      updateOwnerRow(newOwner.row, { owner_id: String(owner.id) });
      setNewOwner(null);
    } catch (err) {
      // e.g. {"email": ["Ya existe un dueño con ese correo."]}
      setOwnerError(extractErrorMessage(err, "No se pudo crear el dueño."));
    } finally {
      setSavingOwner(false);
    }
  };

  /* ── Artist Autocomplete ── */

  const searchArtists = useCallback(
    async (query: string) => {
      if (!query.trim() || !token) {
        setArtistSuggestions([]);
        return;
      }
      try {
        const data = await recordService.searchArtists(query);
        setArtistSuggestions(data ?? []);
        setShowArtistDropdown(true);
      } catch {
        setArtistSuggestions([]);
      }
    },
    [recordService, token]
  );

  const onArtistChange = (value: string) => {
    updateField("artist_text", value);
    updateField("artist_id", "");
    if (artistDebounceRef.current) clearTimeout(artistDebounceRef.current);
    artistDebounceRef.current = setTimeout(() => searchArtists(value), 300);
  };

  const selectArtist = (artist: Artist) => {
    updateField("artist_id", String(artist.id));
    updateField("artist_text", artist.name);
    setShowArtistDropdown(false);
    setArtistSuggestions([]);
  };

  const createAndSelectArtist = useCallback(
    async (name: string) => {
      if (!token || !name.trim()) return;
      try {
        const artist = await recordService.createArtist(name.trim());
        updateField("artist_id", String(artist.id));
        updateField("artist_text", artist.name);
        setShowArtistDropdown(false);
      } catch {
        // Keep the text as-is
      }
    },
    [recordService, token]
  );

  /* ── Discogs Search ── */

  const searchDiscogs = useCallback(
    async (query: string) => {
      if (!query.trim() || !token) return;
      setHasSearched(true);
      const results = await searchDiscogsApi(query);
      setResults(results);
    },
    [searchDiscogsApi, token]
  );

  const onSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchDiscogs(value), 400);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (artistDebounceRef.current) clearTimeout(artistDebounceRef.current);
    };
  }, []);

  /* ── Fetch full Discogs release details ── */

  const fetchReleaseDetails = useCallback(
    async (discogsId: number) => {
      if (!token) return;
      const data = await getReleaseDetail(discogsId);
      if (!data) return;
      const allImages: string[] = data.images ?? [];
      setDiscogsGenreNames([...(data.genres ?? []), ...(data.styles ?? [])]);

      setForm((prev) => ({
        ...prev,
        description: data.description || prev.description,
        images: allImages,
        cover_image_url: allImages[0] || prev.cover_image_url,
        // Try to match genre
        // Discogs genres + styles → every matching genre, unless the admin already picked.
        generes: prev.generes.length
          ? prev.generes
          : matchGenres(data.genres ?? [], data.styles ?? [], generes),
        // Try to match category from formats/genres
        category_id:
          prev.category_id ||
          matchCategory(
            data.formats ?? [],
            data.genres ?? [],
            data.styles ?? [],
            categories
          ),
        // Prefill shipping weight from Discogs (format-based estimate or
        // Discogs' own estimated_weight), unless the admin already set one.
        weight_grams:
          prev.weight_grams ||
          (data.weight_grams_suggestion
            ? String(data.weight_grams_suggestion)
            : ""),
      }));
    },
    [getReleaseDetail, generes, categories, token]
  );

  /* ── Select a Discogs result ── */

  const selectResult = (item: DiscogsSearchResult) => {
    setSelectedId(item.discogs_id);

    updateField("artist_text", item.artist);
    updateField("artist_id", "");

    const discogsNames = [...(item.genre || "").split(","), ...(item.style || "").split(",")]
      .map((name) => name.trim())
      .filter(Boolean);
    setDiscogsGenreNames(discogsNames);
    const matchedGeneres = matchGenres(discogsNames, [], generes);

    // Try to match category from formats
    const matchedCategory = matchCategory(
      item.formats ?? [],
      (item.genre || "").split(",").map((s) => s.trim()),
      (item.style || "").split(",").map((s) => s.trim()),
      categories
    );

    setForm((prev) => ({
      ...prev,
      title: item.title || prev.title,
      artist_text: item.artist,
      artist_id: "",
      generes: matchedGeneres.length ? matchedGeneres : prev.generes,
      cover_image_url: item.cover_image || prev.cover_image_url,
      release_year: item.year ? String(item.year) : prev.release_year,
      category_id: matchedCategory || prev.category_id,
    }));

    fetchReleaseDetails(item.discogs_id);
  };

  /* ── Genre matching helper ── */

  /** Ids of our genres named like a Discogs genre/style (ignoring case and
   * accents). Exact names only, so "Rock" doesn't also pick "Rock Alternativo";
   * with no exact hit, falls back to the first loose (substring) match. */
  function matchGenres(
    discogsGenres: string[],
    discogsStyles: string[],
    genereOptions: Genere[]
  ): string[] {
    const norm = normName;
    const terms = [...discogsGenres, ...discogsStyles].map(norm).filter(Boolean);
    const exact = genereOptions.filter((g) => terms.includes(norm(g.name)));
    if (exact.length) return exact.map((g) => String(g.id));
    const loose = genereOptions.find((g) =>
      terms.some((t) => t.includes(norm(g.name)) || norm(g.name).includes(t))
    );
    return loose ? [String(loose.id)] : [];
  }


  /* ── Render ── */

  return (
    <section className="w-full">
      <h2 className="font-display text-xl sm:text-2xl text-denim">
        {isEditing ? "Editar disco" : T.admin.addRecord.title}
      </h2>
      <p className="mt-2 text-xs sm:text-sm text-navy/60">
        {T.admin.addRecord.subtitle}
      </p>

      {/* ── Discogs Search — hidden when editing ── */}
      {!isEditing && (
        <>
          <div className="mt-6 sm:mt-8 rounded-2xl border border-navy/10 bg-white/60 p-4 sm:p-5 shadow-sm backdrop-blur">
            <label className="block text-sm font-semibold text-navy">
              Buscar en Discogs
            </label>
            <p className="mt-0.5 text-xs text-navy/50">
              Escribe el nombre de un disco o artista para autocompletar los campos.
            </p>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="ej. Pink Floyd, Dark Side of the Moon..."
            />

            {searching && (
              <p className="mt-3 text-sm text-navy/50 animate-pulse">
                Buscando en Discogs...
              </p>
            )}

            {!searching && hasSearched && results.length === 0 && (
              <p className="mt-3 text-sm text-navy/50">
                No se encontraron resultados.
              </p>
            )}

            {!searching && results.length > 0 && (
              <div className="mt-3 max-h-72 sm:max-h-80 overflow-y-auto space-y-2 pr-1">
                {results.map((item) => (
                  <button
                    key={item.discogs_id}
                    type="button"
                    onClick={() => selectResult(item)}
                    className={`flex w-full items-center gap-2 sm:gap-3 rounded-xl border p-2.5 sm:p-3 text-left transition hover:-translate-y-0.5 ${
                      selectedId === item.discogs_id
                        ? "border-orange bg-sun/40"
                        : "border-navy/10 bg-white hover:border-orange/50 hover:bg-sun/20"
                    }`}
                  >
                    {item.cover_image ? (
                      <Img
                        src={item.cover_image}
                        alt={item.title}
                        width={56}
                        className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-base sm:text-lg">
                        🎵
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-semibold text-navy">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] sm:text-xs text-navy/60">
                        {item.artist || "Artista desconocido"}
                      </p>
                      <p className="mt-0.5 text-[10px] sm:text-[11px] text-navy/40 truncate">
                        {[item.year, item.format, item.genre]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {selectedId === item.discogs_id && (
                      <span className="shrink-0 text-sm font-bold text-orange">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Discogs Images — all images collected ── */}
          {form.images.length > 0 && (
            <div className="mt-4 rounded-2xl border border-navy/10 bg-white/60 p-4 shadow-sm backdrop-blur">
              <label className="block text-sm font-semibold text-navy">
                Imágenes de Discogs ({form.images.length})
              </label>
              <p className="mt-0.5 text-xs text-navy/50">
                Todas las imágenes se guardarán. Selecciona cuál es la principal.
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                {form.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateField("cover_image_url", img)}
                    className={`shrink-0 rounded-xl border-2 transition ${
                      form.cover_image_url === img
                        ? "border-orange shadow-md"
                        : "border-transparent hover:border-navy/20"
                    }`}
                  >
                    <Img
                      src={img}
                      alt={`Imagen ${idx + 1}`}
                      width={96}
                      className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Record Form ── */}
      <form
        className="mt-6 sm:mt-8 flex flex-col gap-4 sm:gap-6"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-navy">
            {T.admin.addRecord.fields.title}
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className={inputClass}
            placeholder={T.admin.addRecord.fields.title}
          />
        </div>

        {/* Artist — autocomplete */}
        <div ref={artistContainerRef} className="relative">
          <label className="block text-sm font-semibold text-navy">
            {T.admin.addRecord.fields.artist}
          </label>
          <input
            type="text"
            value={form.artist_text}
            onChange={(e) => onArtistChange(e.target.value)}
            onFocus={() => {
              if (artistSuggestions.length > 0) setShowArtistDropdown(true);
            }}
            className={inputClass}
            placeholder="Escribe el nombre del artista..."
          />

          <DeleteArtistDialog
            artist={artistToDelete}
            recordService={recordService}
            onClose={() => setArtistToDelete(null)}
            onDeleted={({ deleted, reassigned_to }) => {
              setArtistSuggestions((list) => list.filter((a) => a.id !== deleted));
              // If the form had the deleted artist selected, the server already
              // moved its records (this one included) to the target: mirror it.
              if (form.artist_id === String(deleted)) {
                updateField("artist_id", reassigned_to ? String(reassigned_to.id) : "");
                updateField("artist_text", reassigned_to ? reassigned_to.name : "");
              }
            }}
          />

          {showArtistDropdown && artistSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-navy/10 bg-white shadow-lg max-h-64 overflow-y-auto">
              {artistSuggestions.map((a) => (
                <div key={a.id} className="flex items-center hover:bg-sun/30 transition first:rounded-t-xl last:rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => selectArtist(a)}
                    className="min-h-[44px] min-w-0 flex-1 truncate px-4 text-left text-sm text-navy"
                  >
                    {a.name}
                  </button>
                  {/* Delete from the list; records using it get reassigned first. */}
                  {canDeleteArtist && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowArtistDropdown(false);
                        setArtistToDelete({ id: a.id, name: a.name });
                      }}
                      className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-coral transition hover:bg-coral/10"
                      aria-label={`Eliminar artista ${a.name}`}
                      title="Eliminar artista"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {showArtistDropdown &&
            artistSuggestions.length === 0 &&
            form.artist_text.trim().length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-navy/10 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => createAndSelectArtist(form.artist_text)}
                  className="w-full px-4 py-2.5 text-left text-sm text-navy hover:bg-sun/30 transition rounded-xl"
                >
                  + Crear artista "{form.artist_text}"
                </button>
              </div>
            )}
        </div>

        {/* Format + Condition, then Genres: pick, create, rename or delete in place (like Artist) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogPicker
            label={T.admin.addRecord.fields.category}
            noun="formato"
            options={categories as CatalogTerm[]}
            value={form.category_id ? [form.category_id] : []}
            onChange={(ids) => updateField("category_id", ids[ids.length - 1] ?? "")}
            onCreate={
              hasPerm("apiApp.add_category")
                ? async (name) => {
                    const created = await recordService.createCategory({ name });
                    await refreshCatalog();
                    return created as CatalogTerm;
                  }
                : undefined
            }
            onRename={
              hasPerm("apiApp.change_category")
                ? async (term, name) => {
                    await recordService.updateCategory(term.id, { name });
                    await refreshCatalog();
                  }
                : undefined
            }
            onDelete={
              hasPerm("apiApp.delete_category") ? (term) => setTermToDelete({ kind: "format", term }) : undefined
            }
            hint={form.category_id && selectedId !== null ? "Detectado de Discogs. Cámbialo si no es correcto." : undefined}
          />
          <div>
            <label className="block text-sm font-semibold text-navy">
              {T.admin.addRecord.fields.condition}
            </label>
            <select
              value={form.condition}
              onChange={(e) => updateField("condition", e.target.value)}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <CatalogPicker
          label={T.admin.addRecord.fields.genre}
          noun="género"
          multiple
          options={generes as CatalogTerm[]}
          value={form.generes}
          onChange={(ids) => updateField("generes", ids)}
          onCreate={
            hasPerm("apiApp.add_genere")
              ? async (name) => {
                  const created = await recordService.createGenre({ name });
                  await refreshCatalog();
                  return created as CatalogTerm;
                }
              : undefined
          }
          onRename={
            hasPerm("apiApp.change_genere")
              ? async (term, name) => {
                  await recordService.updateGenre(term.id as number, { name });
                  await refreshCatalog();
                }
              : undefined
          }
          onDelete={hasPerm("apiApp.delete_genere") ? (term) => setTermToDelete({ kind: "genre", term }) : undefined}
          suggestions={discogsGenreNames.filter(
            (name, i, all) =>
              all.findIndex((n) => normName(n) === normName(name)) === i &&
              !generes.some((g) => normName(g.name) === normName(name))
          )}
          hint="Puedes elegir varios. Escribe para buscar; Enter agrega."
        />

        <DeleteCatalogTermDialog
          target={termToDelete}
          formats={categories}
          recordService={recordService}
          onClose={() => setTermToDelete(null)}
          onDeleted={({ kind, id, movedTo }) => {
            // Mirror the server: the form drops a deleted genre, and follows its
            // records to the new format when the selected one was deleted.
            if (kind === "genre") {
              updateField("generes", form.generes.filter((g) => g !== id));
            } else if (form.category_id === id) {
              updateField("category_id", movedTo ?? "");
            }
            refreshCatalog().catch(() => {});
          }}
        />

        {/* "Ya existe": offer editing the existing record instead of a duplicate */}
        {!isEditing && matches.length > 0 && (
          <div role="status" className="rounded-xl border border-orange/40 bg-sun/30 p-4">
            <p className="text-sm font-semibold text-navy">
              {matches.length === 1 ? "¿Ya existe este disco?" : "¿Ya existe este disco? Encontramos estos"}
            </p>
            <p className="mt-0.5 text-xs text-navy/60">
              Edítalo para sumar stock o dueños en lugar de crear un duplicado.
            </p>
            <ul className="mt-3 space-y-2">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl bg-white/80 p-2.5">
                  {m.cover_image_url ? (
                    <Img
                      src={m.cover_image_url}
                      alt={m.title}
                      width={48}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy/5">
                      🎵
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {m.title}
                      {m.artist?.name && ` — ${m.artist.name}`}
                    </p>
                    <p className="truncate text-[11px] text-navy/60">
                      {[
                        m.category?.name,
                        m.condition,
                        `stock ${m.stock}`,
                        m.owners?.length
                          ? m.owners.map((o) => `${o.owner_name} ${o.quantity}`).join(", ")
                          : "tienda",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button
                    tone="navy"
                    className="shrink-0 px-3 py-1.5 text-xs"
                    onClick={() => adoptMatch(m.id)}
                  >
                    Editar este
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-navy">
            {T.admin.addRecord.fields.description}
          </label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            className={`${inputClass} resize-y`}
            placeholder={T.admin.addRecord.fields.description}
          />
        </div>

        {/* Cost price + List price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy">
              Precio de costo
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost_price}
              onChange={(e) => updateField("cost_price", e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy">
              Precio de lista
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Live sell price preview + Ganancia */}
        {(() => {
          const basePrice = Number(form.price) || 0;
          const discountPct = Number(form.discount) || 0;
          const cost = Number(form.cost_price) || 0;
          const computedSell = discountPct > 0
            ? basePrice * (1 - discountPct / 100)
            : basePrice;
          const profit = computedSell - cost;
          const hasDiscount = discountPct > 0 && basePrice > 0;

          return (
            <div className="mt-3 rounded-xl border border-navy/10 bg-white/60 backdrop-blur p-4">
              {/* Sell price preview */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-navy/60">Precio de venta:</span>
                {hasDiscount ? (
                  <>
                    <span className="text-sm text-navy/40 line-through">
                      ${basePrice.toFixed(2)}
                    </span>
                    <span className="rounded-full bg-orange/10 px-2.5 py-0.5 text-sm font-bold text-orange">
                      ${computedSell.toFixed(2)}
                    </span>
                    <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-bold text-coral">
                      -{discountPct}%
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-navy">
                    ${basePrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Ganancia */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-green-800">Ganancia:</span>
                <span className={`text-sm font-bold ${profit >= 0 ? "text-green-900" : "text-coral"}`}>
                  {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Discount + Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy">
              {T.admin.addRecord.fields.discount}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.discount}
              onChange={(e) => updateField("discount", e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy">
              {T.admin.addRecord.fields.stock}
            </label>
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => updateField("stock", e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
        </div>

        {/* Cover image URL — shows current primary, all images are in form.images */}
        <div>
          <label className="block text-sm font-semibold text-navy">
            {T.admin.addRecord.fields.coverImage}
          </label>
          <input
            type="url"
            value={form.cover_image_url}
            onChange={(e) => updateField("cover_image_url", e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
          {form.cover_image_url && (
            <Img
              src={form.cover_image_url}
              alt="Preview"
              width={96}
              className="mt-2 h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          {form.images.length > 0 && (
            <p className="mt-1 text-[11px] text-navy/40">
              {form.images.length} imágenes se guardarán con este registro.
            </p>
          )}
        </div>

        {/* Release year + Items inside + Weight */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy">
              {T.admin.addRecord.fields.releaseYear}
            </label>
            <input
              type="number"
              min="1900"
              max="2030"
              value={form.release_year}
              onChange={(e) => updateField("release_year", e.target.value)}
              className={inputClass}
              placeholder="2025"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy">
              {T.admin.addRecord.fields.itemsInside}
            </label>
            <input
              type="number"
              min="1"
              value={form.items_inside}
              onChange={(e) => updateField("items_inside", e.target.value)}
              className={inputClass}
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy">
              Peso (g)
            </label>
            <input
              type="number"
              min="0"
              value={form.weight_grams}
              onChange={(e) => updateField("weight_grams", e.target.value)}
              className={inputClass}
              placeholder="300"
            />
            <p className="mt-1 text-[11px] text-navy/40">
              Para el envío. Se llena desde Discogs; vacío usa default por
              formato (LP 300 g, 7&quot; 100 g, CD 85 g).
            </p>
          </div>
        </div>

        {/* Owners — whose units the stock is; several owners split it */}
        <div>
          <span className="block text-sm font-semibold text-navy">
            {T.admin.addRecord.fields.owner}
          </span>
          {form.owners.length === 0 && (
            <p className="mt-1 text-[11px] text-navy/40">
              Sin dueño: el stock es de la tienda.
            </p>
          )}
          <ul className="mt-1 space-y-2">
            {form.owners.map((row, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <select
                    aria-label={`Dueño ${i + 1}`}
                    value={newOwner?.row === i ? NEW_OWNER : row.owner_id}
                    disabled={newOwner !== null && newOwner.row !== i}
                    onChange={(e) => {
                      if (e.target.value === NEW_OWNER) {
                        setNewOwner({ name: "", email: "", row: i });
                        setOwnerError(null);
                      } else {
                        setNewOwner(null);
                        updateOwnerRow(i, { owner_id: e.target.value });
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">Seleccionar dueño...</option>
                    {/* An owner can only be in one row */}
                    {owners
                      .filter(
                        (o) =>
                          String(o.id) === row.owner_id ||
                          !form.owners.some((r) => r.owner_id === String(o.id))
                      )
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.email})
                        </option>
                      ))}
                    <option value={NEW_OWNER}>➕ Agregar nuevo dueño</option>
                  </select>
                </div>
                {form.owners.length > 1 && (
                  <div className="w-24 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max={stockCount}
                      aria-label={`Cantidad del dueño ${i + 1}`}
                      value={row.quantity}
                      onChange={(e) => setOwnerQuantity(i, e.target.value)}
                      className={inputClass}
                      placeholder="Cant."
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeOwnerRow(i)}
                  disabled={newOwner !== null}
                  aria-label={`Quitar dueño ${i + 1}`}
                  className="mt-1 flex h-[46px] w-10 shrink-0 items-center justify-center rounded-xl text-coral transition hover:bg-coral/10 disabled:opacity-40"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {newOwner && (
            <div className="mt-2 rounded-xl border border-navy/10 bg-cream/60 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={newOwner.name}
                  onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
                  placeholder="Nombre"
                  aria-label="Nombre del nuevo dueño"
                  className={inputClass}
                />
                <input
                  type="email"
                  value={newOwner.email}
                  onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  aria-label="Correo del nuevo dueño"
                  className={inputClass}
                />
              </div>
              {ownerError && (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {ownerError}
                </p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  tone="outline"
                  className="px-3 py-1.5 text-xs"
                  disabled={savingOwner}
                  onClick={() => setNewOwner(null)}
                >
                  Cancelar
                </Button>
                <Button
                  tone="navy"
                  className="px-3 py-1.5 text-xs"
                  disabled={savingOwner}
                  onClick={saveOwner}
                >
                  {savingOwner ? "Guardando..." : "Guardar dueño"}
                </Button>
              </div>
            </div>
          )}
          {ownerLimit && (
            <p role="alert" className="mt-2 text-xs font-semibold text-coral">
              {ownerLimit}
            </p>
          )}
          {!newOwner && (
            <button
              type="button"
              onClick={addOwnerRow}
              className="mt-2 text-sm font-semibold text-orange hover:underline"
            >
              + Agregar dueño
            </button>
          )}
          {form.owners.length === 1 && (
            <p className="mt-1 text-[11px] text-navy/40">
              Todo el stock ({stockCount}) es de este dueño. Recibe un correo cada vez que se vende.
            </p>
          )}
          {form.owners.length > 1 && (
            <p
              className={`mt-1 text-[11px] ${
                ownersTotal === Number(form.stock) ? "text-navy/40" : "font-semibold text-coral"
              }`}
            >
              {ownersTotal === stockCount
                ? `Suman ${ownersTotal} de ${stockCount} en stock.`
                : ownersTotal > stockCount
                  ? `Suman ${ownersTotal} pero el stock es ${stockCount}: baja las cantidades o sube el stock.`
                  : `Suman ${ownersTotal} de ${stockCount}: faltan ${stockCount - ownersTotal} por asignar.`}{" "}
              Cada dueño recibe un correo cuando se vende uno suyo.
            </p>
          )}
        </div>

        {/* Featured */}
        <div className="rounded-xl border border-navy/10 bg-cream/60 p-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="featured"
              checked={form.featured}
              onChange={(e) => updateField("featured", e.target.checked)}
              className="h-5 w-5 rounded border-navy/30 accent-orange"
            />
            <label
              htmlFor="featured"
              className="text-sm font-semibold text-navy"
            >
              {T.admin.addRecord.fields.featured}
            </label>
          </div>
          <p className="mt-1 text-[11px] text-navy/50">
            Los discos "destacados" aparecen en la página principal del
            catálogo. Si está desactivado, solo se muestra al buscar.
          </p>
        </div>

        {/* Submit error */}
        {submitError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </p>
        )}

        {/* Submit success */}
        {submitSuccess && (
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {isEditing ? "Disco actualizado exitosamente." : "Disco agregado exitosamente."}
          </p>
        )}

        {isEditing && (
          <Button
            tone="outline"
            className="mt-2 w-full py-3 text-base"
            onClick={adopted ? cancelAdopted : onEditDone}
          >
            Cancelar
          </Button>
        )}

        <Button
          tone="orange"
          className="mt-2 w-full py-3 text-base"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Guardando..." : isEditing ? "Actualizar Disco" : T.admin.addRecord.submit}
        </Button>
      </form>
    </section>
  );
}
