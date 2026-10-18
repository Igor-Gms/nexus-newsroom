const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function relativeTime(iso: string | number, now = Date.now()) {
  const diff = (typeof iso === "number" ? iso : Date.parse(iso)) - now;
  const abs = Math.abs(diff);
  if (abs < 6e4) return "agora";
  if (abs < 36e5) return rtf.format(Math.round(diff / 6e4), "minute");
  if (abs < 864e5) return rtf.format(Math.round(diff / 36e5), "hour");
  if (abs < 30 * 864e5) return rtf.format(Math.round(diff / 864e5), "day");
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
