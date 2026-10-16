import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, subscribeTheme, toggleTheme } from "../theme";
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "light");
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  const Icon = theme === "dark" ? Sun : Moon;
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label} title={label}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></button>;
}
