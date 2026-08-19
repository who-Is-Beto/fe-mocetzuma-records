import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { T } from "../../app/i18n/strings";
import { Button } from "../../components/Button";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { API_BASE_URL } from "../../app/config/api";

/* ── Types ── */

type DiscogsResult = {
  discogs_id: number;
  title: string;
  artist: string;
  year: number | null;
  cover_image: string;
  genre: string;
  style: string;
  format: string;
  formats: string[];
  resource_url: string;
  uri: string;
};

type Artist = { id: number; name: string; slug: string };
type Genere = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string };

type RecordForm = {
  title: string;
  artist_id: string;
  artist_text: string;
  description: string;
  condition: string;
  genere_id: string;
  price: string;
  cost_price: string;
  stock: string;
  cover_image_url: string;
  images: string[];
  discount: string;
  release_year: string;
  items_inside: string;
  category_id: string;
  featured: boolean;
};

const INITIAL_FORM: RecordForm = {
  title: "",
  artist_id: "",
  artist_text: "",
  description: "",
  condition: "",
  genere_id: "",
  price: "",
  cost_price: "",
  stock: "",
  cover_image_url: "",
  images: [],
  discount: "",
  release_year: "",
  items_inside: "1",
  category_id: "",
  featured: true,
};

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
    artist?: { id: string; name: string } | null;
    genere?: { id: string; name: string } | { id?: string | number } | string | number | null;
    category?: { id: string; name: string } | null;
    slug?: string;
  } | null;
  onEditDone?: () => void;
};

/* ── Component ── */

export function AddRecordPage({ editingRecord, onEditDone }: AddRecordPageProps = {}) {
  const { token } = useAuth();

  const isEditing = Boolean(editingRecord);

  // Discogs search
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<DiscogsResult[]>([]);
  const [searching, setSearching] = useState(false);
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

  // Form
  const [form, setForm] = useState<RecordForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  /* ── Pre-fill form when editing ── */

  useEffect(() => {
    if (!editingRecord) return;
    setForm({
      title: editingRecord.title || "",
      artist_id: editingRecord.artist?.id ? String(editingRecord.artist.id) : "",
      artist_text: editingRecord.artist?.name || "",
      description: editingRecord.description || "",
      condition: editingRecord.condition || "M",
      genere_id: editingRecord.genere && typeof editingRecord.genere === "object" && "id" in editingRecord.genere
        ? String(editingRecord.genere.id)
        : "",
      price: String(editingRecord.price ?? ""),
      cost_price: String(editingRecord.cost_price ?? ""),
      stock: String(editingRecord.stock ?? ""),
      cover_image_url: editingRecord.cover_image_url || "",
      images: editingRecord.images || [],
      discount: String(editingRecord.discount_porcentage ?? ""),
      release_year: editingRecord.release_date ? String(editingRecord.release_date) : "",
      items_inside: String(editingRecord.items_inside ?? "1"),
      category_id: editingRecord.category?.id ? String(editingRecord.category.id) : "",
      featured: editingRecord.featured ?? true,
    });
  }, [editingRecord]);

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

    if (!token) {
      setSubmitError("No estás autenticado.");
      return;
    }

    try {
      setSubmitting(true);

      // Ensure artist exists: create if text provided but no ID selected
      let artistId: string | null = form.artist_id || null;
      if (!artistId && form.artist_text.trim()) {
        const artistRes = await fetch(``${API_BASE_URL}/artists/create/``, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: form.artist_text.trim() }),
        });
        if (!artistRes.ok) {
          const errData = await artistRes.json().catch(() => null);
          setSubmitError(extractErrorMessage(errData, "Error al crear el artista."));
          return;
        }
        const created = await artistRes.json();
        artistId = String(created.id);
      }

      // Build the payload
      const payload = {
        title: form.title.trim(),
        artist: artistId ? Number(artistId) : null,
        description: form.description.trim() || null,
        condition: form.condition || "M",
        genere: form.genere_id ? Number(form.genere_id) : null,
        cover_image_url: form.cover_image_url.trim() || null,
        price: Number(form.price) || 0,
        cost_price: Number(form.cost_price) || 0,
        discount_porcentage: Number(form.discount) || 0,
        stock: Number(form.stock),
        images: form.images,
        release_date: form.release_year ? Number(form.release_year) : null,
        featured: form.featured,
        items_inside: Number(form.items_inside) || 1,
        category: form.category_id ? Number(form.category_id) : null,
      };

      if (isEditing && editingRecord) {
        // PATCH to update
        const res = await fetch(`${API_BASE_URL}/records/${editingRecord.id}/update/`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setSubmitError(extractErrorMessage(errData, "Error al actualizar el disco."));
          return;
        }
        setSubmitSuccess(true);
        setTimeout(() => {
          onEditDone?.();
          setForm(INITIAL_FORM);
          setSubmitSuccess(false);
          setResults([]);
          setHasSearched(false);
          setSelectedId(null);
          setSearchQuery("");
        }, 1500);
      } else {
        // POST to create
        const res = await fetch(`${API_BASE_URL}/records/create/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setSubmitError(extractErrorMessage(errData, "Error al guardar el disco."));
          return;
        }

        await res.json();
        setSubmitSuccess(true);

        // Reset form after success
        setTimeout(() => {
          setForm(INITIAL_FORM);
          setSubmitSuccess(false);
          setResults([]);
          setHasSearched(false);
          setSelectedId(null);
          setSearchQuery("");
        }, 2000);
      }
    } catch {
      setSubmitError("Error de red. Verifica tu conexión.");
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch DB options on mount
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const base = API_BASE_URL;

    Promise.all([
      fetch(`${base}/generes/`, { headers }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${base}/categories/`, { headers }).then((r) =>
        r.ok ? r.json() : []
      ),
    ]).then(([genereData, catData]) => {
      setGeneres(genereData ?? []);
      setCategories(catData ?? []);
    });
  }, [token]);

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

  /* ── Artist Autocomplete ── */

  const searchArtists = useCallback(
    async (query: string) => {
      if (!query.trim() || !token) {
        setArtistSuggestions([]);
        return;
      }
      try {
        const url = new URL(`${API_BASE_URL}/artists/search/`);
        url.searchParams.set("q", query);
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setArtistSuggestions(data ?? []);
        setShowArtistDropdown(true);
      } catch {
        setArtistSuggestions([]);
      }
    },
    [token]
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
        const res = await fetch(``${API_BASE_URL}/artists/create/``, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) return;
        const artist = await res.json();
        updateField("artist_id", String(artist.id));
        updateField("artist_text", artist.name);
        setShowArtistDropdown(false);
      } catch {
        // Keep the text as-is
      }
    },
    [token]
  );

  /* ── Discogs Search ── */

  const searchDiscogs = useCallback(
    async (query: string) => {
      if (!query.trim() || !token) return;
      setSearching(true);
      setHasSearched(true);
      try {
        const url = new URL(`${API_BASE_URL}/discogs/search/`);
        url.searchParams.set("q", query.trim());
        url.searchParams.set("per_page", "25");
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [token]
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
      try {
        const res = await fetch(
          `${API_BASE_URL}/discogs/releases/${discogsId}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        const allImages: string[] = data.images ?? [];

        setForm((prev) => ({
          ...prev,
          description: data.description || prev.description,
          images: allImages,
          cover_image_url: allImages[0] || prev.cover_image_url,
          // Try to match genre
          genere_id:
            prev.genere_id ||
            matchGenreToSelect(data.genres, data.styles, generes),
          // Try to match category from formats/genres
          category_id:
            prev.category_id ||
            matchCategory(
              data.formats ?? [],
              data.genres ?? [],
              data.styles ?? [],
              categories
            ),
        }));
      } catch {
        // Silently fail
      }
    },
    [token, generes, categories]
  );

  /* ── Select a Discogs result ── */

  const selectResult = (item: DiscogsResult) => {
    setSelectedId(item.discogs_id);

    updateField("artist_text", item.artist);
    updateField("artist_id", "");

    // Try to match genre from search result
    const firstGenre = item.genre.split(",")[0]?.trim() ?? "";
    const matchedGenere = generes.find(
      (g) => g.name.toLowerCase() === firstGenre.toLowerCase()
    );

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
      genere_id: matchedGenere ? String(matchedGenere.id) : prev.genere_id,
      cover_image_url: item.cover_image || prev.cover_image_url,
      release_year: item.year ? String(item.year) : prev.release_year,
      category_id: matchedCategory || prev.category_id,
    }));

    fetchReleaseDetails(item.discogs_id);
  };

  /* ── Genre matching helper ── */

  function matchGenreToSelect(
    discogsGenres: string[],
    discogsStyles: string[],
    genereOptions: Genere[]
  ): string {
    const allTerms = [...discogsGenres, ...discogsStyles].map((s) =>
      s.toLowerCase()
    );
    for (const g of genereOptions) {
      if (allTerms.some((t) => t.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(t))) {
        return String(g.id);
      }
    }
    return "";
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
                      <img
                        src={item.cover_image}
                        alt={item.title}
                        className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 rounded-lg object-cover"
                        loading="lazy"
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
                    <img
                      src={img}
                      alt={`Imagen ${idx + 1}`}
                      className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover"
                      loading="lazy"
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

          {showArtistDropdown && artistSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-navy/10 bg-white shadow-lg max-h-48 overflow-y-auto">
              {artistSuggestions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => selectArtist(a)}
                  className="w-full px-4 py-2.5 text-left text-sm text-navy hover:bg-sun/30 transition first:rounded-t-xl last:rounded-b-xl"
                >
                  {a.name}
                </button>
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

        {/* Condition + Genre */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-semibold text-navy">
              {T.admin.addRecord.fields.genre}
            </label>
            <select
              value={form.genere_id}
              onChange={(e) => updateField("genere_id", e.target.value)}
              className={inputClass}
            >
              <option value="">Seleccionar género...</option>
              {generes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
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
            <img
              src={form.cover_image_url}
              alt="Preview"
              className="mt-2 h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover shadow-sm"
              loading="lazy"
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

        {/* Release year + Items inside */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        {/* Category — select, auto-matched from Discogs */}
        <div>
          <label className="block text-sm font-semibold text-navy">
            {T.admin.addRecord.fields.category}
          </label>
          <select
            value={form.category_id}
            onChange={(e) => updateField("category_id", e.target.value)}
            className={inputClass}
          >
            <option value="">Seleccionar categoría...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {form.category_id && (
            <p className="mt-1 text-[11px] text-navy/40">
              Auto-detectado de Discogs. Cambia si es necesario.
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
            onClick={onEditDone}
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
