// Temp diagnostic: sequential plugin imports with a per-module watchdog
const mods = ["@eslint/js", "globals", "eslint-plugin-react-hooks", "eslint-plugin-react-refresh", "typescript-eslint", "eslint/config", "./eslint.config.js"];
for (const m of mods) {
  const t = Date.now();
  const result = await Promise.race([
    import(m).then(() => "OK ").catch((e) => "ERR " + e.message.slice(0, 80)),
    new Promise((res) => setTimeout(() => res("HUNG"), 6000)),
  ]);
  console.log(`${result} ${Date.now() - t}ms  ${m}`);
}
console.log("--- done ---");