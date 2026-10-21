import { QRCodeSVG } from "qrcode.react";

// Kept in its own module so the QR library is only downloaded when a member opens the QR panel.
export default function LiveLedgerQr({ value }: { value: string }) {
  return <QRCodeSVG value={value} size={220} level="M" title="QR code to open the authenticated Live ledger" />;
}
