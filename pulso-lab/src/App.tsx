import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { pages, type PageId } from "./nav";
import { EmBreve } from "./pages/EmBreve";
import { Painel } from "./pages/Painel";
import { load, save } from "./storage";

type Theme = "dark" | "light";

export function App() {
  const [current, setCurrent] = useState<PageId>("painel");
  const [theme, setTheme] = useState<Theme>(() => load<Theme>("pulso.theme", "dark"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save("pulso.theme", theme);
  }, [theme]);

  return (
    <div className="app">
      <Sidebar
        current={current}
        onNavigate={setCurrent}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <main className="content">
        {current === "painel" ? <Painel onNavigate={setCurrent} /> : <EmBreve page={pages[current]} />}
      </main>
    </div>
  );
}
