import { PolyShell } from "./PolyShell";
import "./poly-shell.css";

export default function PolyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PolyShell>{children}</PolyShell>;
}
