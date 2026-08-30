import { AlertCircle } from "lucide-react";

function ErrorAlert({ error }) {
  if (!error) return null;

  return (
    <div className="alert">
      <AlertCircle size={20} />

      <span>{error}</span>
    </div>
  );
}

export default ErrorAlert;
