import { useNavigate } from "react-router-dom";
import { T } from "../../app/i18n/strings";
import { useSeo } from "../../app/hooks/useSeo";
import { Button } from "../../components/Button";

type Props = {
  /** Optional admin-customized message shown while the window is open. */
  message?: string;
};

export function MaintenancePage({ message }: Props) {
  useSeo({ title: T.maintenance.title, noindex: true });
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-xl py-20 text-center">
      <div className="text-5xl">🛠️</div>
      <h1 className="mt-4 font-display text-2xl text-denim">
        {T.maintenance.title}
      </h1>
      <p className="mt-3 text-sm text-navy/60">
        {message?.trim() || T.maintenance.body}
      </p>
      <Button
        tone="navy"
        className="mt-8"
        onClick={() => navigate("/")}
      >
        {T.shared.backHome}
      </Button>
    </section>
  );
}