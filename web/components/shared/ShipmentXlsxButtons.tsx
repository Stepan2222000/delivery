"use client";

import { ImportXlsxButton } from "./ImportXlsxButton";

export function ShipmentXlsxButtons({
  trackingNumbers,
  shipmentId,
  isDraft,
}: {
  trackingNumbers: string[];
  shipmentId: string;
  isDraft: boolean;
}) {
  const downloadXlsx = () => {
    if (trackingNumbers.length === 0) return;
    const url = `/api/export.xlsx?ids=${encodeURIComponent(trackingNumbers.join(","))}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-shipment-${shipmentId}.xlsx`;
    a.click();
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={downloadXlsx}
        disabled={trackingNumbers.length === 0}
      >
        Скачать xlsx
      </button>
      {isDraft && <ImportXlsxButton />}
    </div>
  );
}
