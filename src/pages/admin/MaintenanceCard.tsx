import { useEffect, useRef, useState } from "react";
import { T } from "../../app/i18n/strings";
import { useMaintenanceConfig } from "../../app/hooks/useMaintenanceConfig";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";

/**
 * Opens/closes the site-wide maintenance window. While it is active the
 * backend answers 503 to everyone except admins, so this is the only way in
 * (and back out).
 */
export function MaintenanceCard() {
  const { config, isLoading, save } = useMaintenanceConfig();
  const [mode, setMode] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const syncedOnce = useRef(false);

  // Load the server values into the drafts exactly once.
  useEffect(() => {
    if (config && !syncedOnce.current) {
      syncedOnce.current = true;
      setMode(config.maintenance_mode);
      setMessage(config.maintenance_message);
    }
  }, [config]);

  const dirty = config
    ? mode !== config.maintenance_mode ||
      message !== config.maintenance_message
    : false;

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await save(mode, message);
      setFeedback({ kind: "success", text: T.admin.maintenance.saved });
    } catch {
      setFeedback({ kind: "error", text: T.admin.maintenance.error });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !config) {
    return (
      <section className="mt-6 sm:mt-8 flex items-center justify-center rounded-2xl border border-navy/10 bg-cream/60 p-4 sm:p-5">
        <Loader />
      </section>
    );
  }

  return (
    <section className="mt-6 sm:mt-8 rounded-2xl border border-navy/10 bg-cream/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-navy sm:text-base">
            {T.admin.maintenance.title}
          </h2>
          <p className="mt-1 max-w-xl text-xs text-navy/60">
            {T.admin.maintenance.description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              mode
                ? "bg-orange/90 text-charcoal"
                : "bg-navy/10 text-navy/60"
            }`}
          >
            {mode ? T.admin.maintenance.active : T.admin.maintenance.inactive}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={mode}
            aria-label={T.admin.maintenance.label}
            onClick={() => setMode((v) => !v)}
            className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
              mode ? "bg-orange" : "bg-navy/25"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                mode ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {mode && (
        <div className="mt-4 space-y-2">
          <label
            htmlFor="maintenance-message"
            className="block text-xs font-semibold text-navy/70"
          >
            {T.admin.maintenance.messageHelp}
          </label>
          <textarea
            id="maintenance-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={255}
            placeholder={T.admin.maintenance.messagePlaceholder}
            className="w-full rounded-xl border border-navy/10 bg-white px-3 py-2 text-sm text-navy outline-none transition placeholder:text-navy/30 focus:border-orange"
          />
          <p className="text-xs text-orange/90">{T.admin.maintenance.activeNote}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {feedback && (
          <p
            className={`text-xs font-semibold ${
              feedback.kind === "success" ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {feedback.text}
          </p>
        )}
        <Button
          tone="navy"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-2 text-xs sm:text-sm"
        >
          {saving ? T.admin.maintenance.busy : T.admin.maintenance.save}
        </Button>
      </div>
    </section>
  );
}