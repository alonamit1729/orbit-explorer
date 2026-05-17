import type { SharkovskyJSON } from "../types";

export function SharkovskyNote({ data }: { data: SharkovskyJSON }) {
  if (!data.found.length && !data.proven_absent.length) {
    return null;
  }
  return (
    <div className="sharkovsky">
      <strong>Sharkovsky:</strong> {data.note}
      {data.implied_but_not_found.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6b6b6b" }}>
          Periods implied beyond search range:{" "}
          {data.implied_but_not_found.slice(0, 15).join(", ")}
          {data.implied_but_not_found.length > 15 ? ", …" : ""}
        </div>
      )}
    </div>
  );
}
