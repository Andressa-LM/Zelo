import { useState } from "react";

type Props = {
  name: string;
  unit: string;
  dose: string;
  image?: string;
  className?: string;
};

function artworkKind(name: string, unit: string, dose: string): "tablet" | "liquid" | "injection" {
  const description = `${name} ${unit} ${dose}`.toLocaleLowerCase("pt-BR");
  if (/ampola|inje[cç][aã]o|seringa/.test(description)) return "injection";
  if (["ml", "gotas", "frascos"].includes(unit.toLocaleLowerCase("pt-BR")) || /gotas|xarope|solu[cç][aã]o/.test(description)) return "liquid";
  return "tablet";
}

export function MedicationArtwork({ name, unit, dose, image, className = "" }: Props) {
  const [failedImage, setFailedImage] = useState("");
  const kind = artworkKind(name, unit, dose);
  const showImage = Boolean(image && image !== failedImage);

  return (
    <div className={`medication-artwork ${className}`} role="img" aria-label={`Ilustração de ${name || "medicamento"}`}>
      {showImage ? (
        <img src={image} alt="" loading="lazy" onError={() => setFailedImage(image ?? "")} />
      ) : (
        <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
          {kind === "tablet" && (
            <g transform="rotate(-38 40 40)">
              <rect x="22" y="13" width="36" height="54" rx="18" fill="#f3e5ce" stroke="#9e8065" strokeWidth="2.5" />
              <path d="M22 40h36" stroke="#9e8065" strokeWidth="2.5" />
              <path d="M24 32a15 15 0 0 1 27-9" fill="none" stroke="#fffaf0" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
          {kind === "liquid" && (
            <g>
              <path d="M31 13h18v10l7 7v31a5 5 0 0 1-5 5H29a5 5 0 0 1-5-5V30l7-7z" fill="#e8eee1" stroke="#71886b" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M31 13h18v8H31z" fill="#d2b88e" stroke="#8e7554" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M26 43h28v15H26z" fill="#fffdf7" stroke="#b6c4a8" strokeWidth="2" />
              <path d="M34 50h12" stroke="#8b9b7d" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          {kind === "injection" && (
            <g transform="rotate(-40 40 40)" fill="none" stroke="#71886b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M28 22h25v37H28z" fill="#e8eee1" />
              <path d="M33 31h15M33 38h15M33 45h10" />
              <path d="M36 15v7m9-7v7M36 59v8m9-8v8M40.5 67v8" />
              <path d="m51 24 6-6m-2 12 6-6" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
