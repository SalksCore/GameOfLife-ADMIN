import type { ReactNode } from 'react';
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, decodePortrait } from '../avatars';

/**
 * Portrait vectoriel d'un joueur, dessiné à partir de son code (voir avatars.ts).
 * Aucun dégradé ni effet : aplats, formes simples, lisible dès 28 px.
 * `bg` : couleur de fond (hexadécimale) ; par défaut la couleur du joueur héritée du CSS (--pc-2).
 * Ce fichier existe en deux copies (phone, admin) : à garder synchronisées.
 */

const INK = '#1c1917';
const SHADE = 'rgba(0,0,0,0.2)';
const LIGHT = '#f4f1ea';

const SHOULDERS = 'M6 64 C6 51 19 46 32 46 C45 46 58 51 58 64Z';

const FRONT_CAP = 'M21 28 C20 15 27 12 32 12 C38 12 44 15 43 28 C40 22 36 19.5 32 19.5 C28 19.5 24 22 21 28Z';

/** Cheveux : partie derrière la tête, puis partie devant */
function hairBack(style: number, fill: string): ReactNode {
  switch (style) {
    case 2:
      return <path d="M20 27 C19 10 45 10 44 27 L46 43 L18 43Z" fill={fill} />;
    case 3:
      return <path d="M20 27 C19 9 45 9 44 27 L48 56 L16 56Z" fill={fill} />;
    case 4:
      return <circle cx="32" cy="24" r="16.5" fill={fill} />;
    case 7:
      return (
        <>
          <circle cx="21" cy="38" r="4.2" fill={fill} />
          <circle cx="43" cy="38" r="4.2" fill={fill} />
        </>
      );
    default:
      return null;
  }
}
function hairFront(style: number, fill: string): ReactNode {
  switch (style) {
    case 1:
    case 7:
      return <path d={FRONT_CAP} fill={fill} />;
    case 2:
    case 3:
      return (
        <path d="M21 28 C20 16 27 13 32 13 C38 13 44 16 43 28 C41 22 37 20 32 20 C27 20 23 22 21 28Z" fill={fill} />
      );
    case 4:
      return (
        <path
          d="M21.5 25 C21 17 26 14 32 14 C38 14 43 17 42.5 25 C39 21 36 19 32 19 C28 19 25 21 21.5 25Z"
          fill={fill}
        />
      );
    case 5:
      return (
        <>
          <path d={FRONT_CAP} fill={fill} />
          <circle cx="32" cy="9.5" r="5" fill={fill} />
        </>
      );
    case 6:
      return (
        <path
          d="M21 28 C18 14 30 9 38 12.5 C45 15 44 22 43 28 C41 22 36 17.5 27 22 C24 23.5 22.5 25.5 21 28Z"
          fill={fill}
        />
      );
    default:
      return null;
  }
}

function Outfit({ style }: { style: number }): ReactNode {
  switch (style) {
    case 1: // sweat à capuche
      return (
        <>
          <path d="M19 47 Q32 59 45 47 L45 51 Q32 63 19 51Z" fill={SHADE} />
          <path d="M29 55 V61 M35 55 V61" stroke={LIGHT} strokeOpacity="0.75" strokeWidth="1.3" strokeLinecap="round" />
        </>
      );
    case 2: // chemise
      return (
        <>
          <path d="M24.5 46.5 L32 57 L28 47Z M39.5 46.5 L32 57 L36 47Z" fill={LIGHT} />
          <path d="M32 57 V64" stroke={SHADE} strokeWidth="1.2" />
        </>
      );
    case 3: // veste
      return (
        <>
          <path d="M27 46.5 L32 55 L37 46.5Z" fill={LIGHT} />
          <path
            d="M24 46.5 L32 60 L40 46.5 M32 60 V64"
            stroke={SHADE}
            strokeWidth="2"
            fill="none"
            strokeLinejoin="round"
          />
        </>
      );
    case 5: // blouson
      return (
        <>
          <path d="M24 46.3 Q32 52 40 46.3 L40 49.5 Q32 55 24 49.5Z" fill={SHADE} />
          <path d="M32 53 V64" stroke={LIGHT} strokeOpacity="0.6" strokeWidth="1.2" />
        </>
      );
    default: // t-shirt (0) et col roulé (4, dessiné avec le cou)
      return (
        <path d="M25.5 46.3 Q32 52.5 38.5 46.3" stroke={SHADE} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      );
  }
}

function Face({ style }: { style: number }): ReactNode {
  const eye = { fill: INK };
  const line = { stroke: INK, strokeWidth: 1.5, strokeLinecap: 'round' as const, fill: 'none' };
  switch (style) {
    case 1: // sourire
      return (
        <>
          <circle cx="27.5" cy="30" r="1.5" {...eye} />
          <circle cx="36.5" cy="30" r="1.5" {...eye} />
          <path d="M27.5 36 Q32 41 36.5 36" {...line} />
        </>
      );
    case 2: // paisible
      return (
        <>
          <path d="M25.5 30.2 Q27.5 32 29.5 30.2 M34.5 30.2 Q36.5 32 38.5 30.2" {...line} />
          <path d="M29 37.3 Q32 38.8 35 37.3" {...line} />
        </>
      );
    case 3: // clin d'œil
      return (
        <>
          <circle cx="27.5" cy="30" r="1.5" {...eye} />
          <path d="M34.5 30.4 Q36.5 28.6 38.5 30.4" {...line} />
          <path d="M28 36.8 Q33 39.5 37.5 35.8" {...line} />
        </>
      );
    case 4: // concentré
      return (
        <>
          <circle cx="27.5" cy="30.5" r="1.4" {...eye} />
          <circle cx="36.5" cy="30.5" r="1.4" {...eye} />
          <path d="M24.8 26.8 L30 27.8 M34 27.8 L39.2 26.8" {...line} />
          <path d="M29 37.5 H35" {...line} />
        </>
      );
    case 5: // surpris
      return (
        <>
          <circle cx="27.5" cy="30" r="1.8" {...eye} />
          <circle cx="36.5" cy="30" r="1.8" {...eye} />
          <ellipse cx="32" cy="37.5" rx="1.9" ry="2.3" {...eye} />
        </>
      );
    default: // neutre
      return (
        <>
          <circle cx="27.5" cy="30" r="1.5" {...eye} />
          <circle cx="36.5" cy="30" r="1.5" {...eye} />
          <path d="M28.5 37 Q32 38.6 35.5 37" {...line} />
        </>
      );
  }
}

function Accessory({ style, tint }: { style: number; tint: string }): ReactNode {
  switch (style) {
    case 1: // lunettes rondes
      return (
        <g fill="none" stroke={INK} strokeWidth="1.3">
          <circle cx="27.5" cy="30" r="4.4" />
          <circle cx="36.5" cy="30" r="4.4" />
          <path d="M31.9 30 H32.1 M21.2 29 L23.1 29.6 M42.8 29 L40.9 29.6" />
        </g>
      );
    case 2: // lunettes carrées
      return (
        <g fill="none" stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
          <rect x="23" y="26.5" width="9" height="7" rx="1.2" />
          <rect x="32" y="26.5" width="9" height="7" rx="1.2" />
          <path d="M32 29 H32 M20.8 28 L23 28.5 M43.2 28 L41 28.5" />
        </g>
      );
    case 3: // casque audio
      return (
        <>
          <path d="M20.2 29 C19 8 45 8 43.8 29" fill="none" stroke="#14110f" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="17.6" y="27" width="4.6" height="9" rx="1.8" fill="#14110f" />
          <rect x="41.8" y="27" width="4.6" height="9" rx="1.8" fill="#14110f" />
        </>
      );
    case 4: // boucles d'oreilles
      return (
        <>
          <circle cx="20.6" cy="35.6" r="1.7" fill="#d4af37" />
          <circle cx="43.4" cy="35.6" r="1.7" fill="#d4af37" />
        </>
      );
    case 5: // bonnet
      return (
        <>
          <path d="M20.6 25.5 C20 10 44 10 43.4 25.5Z" fill={tint} />
          <rect x="19.8" y="22.8" width="24.4" height="4.6" rx="2" fill={tint} />
          <rect x="19.8" y="22.8" width="24.4" height="4.6" rx="2" fill={SHADE} />
        </>
      );
    default:
      return null;
  }
}

function Motif({ style }: { style: number }): ReactNode {
  const w = { stroke: '#fff', strokeOpacity: 0.13, fill: 'none' };
  switch (style) {
    case 1:
      return (
        <g {...w} strokeWidth="4">
          {[-3, -2, -1, 0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M${i * 12 - 12} 64 L${i * 12 + 52} 0`} />
          ))}
        </g>
      );
    case 2:
      return (
        <g fill="#fff" fillOpacity="0.14">
          {[0, 1, 2, 3, 4].flatMap((r) =>
            [0, 1, 2, 3, 4].map((c) => <circle key={`${r}${c}`} cx={6 + c * 13} cy={6 + r * 13} r="1.7" />),
          )}
        </g>
      );
    case 3:
      return (
        <g {...w} strokeWidth="1">
          {[16, 32, 48].map((p) => (
            <path key={p} d={`M${p} 0 V64 M0 ${p} H64`} />
          ))}
        </g>
      );
    case 4:
      return (
        <g {...w} strokeWidth="3" strokeLinejoin="round">
          {[0, 16, 32, 48].map((y) => (
            <path key={y} d={`M0 ${y + 8} L32 ${y + 22} L64 ${y + 8}`} />
          ))}
        </g>
      );
    case 5:
      return (
        <g {...w} strokeWidth="2">
          {[20, 28, 36].map((r) => (
            <circle key={r} cx="32" cy="34" r={r} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

export function Portrait({ code, bg }: { code: string; bg?: string }) {
  const s = decodePortrait(code);
  const skin = SKIN_TONES[s.skin]!;
  const hair = HAIR_COLORS[s.hairColor]!;
  const outfit = OUTFIT_COLORS[s.outfitColor]!;
  const turtleneck = s.outfit === 4;

  return (
    <svg className="portrait" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" style={bg ? { fill: bg } : { fill: 'var(--pc-2)' }} />
      <Motif style={s.motif} />
      {hairBack(s.hair, hair)}
      <path d={SHOULDERS} fill={outfit} />
      <Outfit style={s.outfit} />
      {/* cou */}
      <rect x="28" y="36" width="8" height="12" fill={skin} />
      <path d="M28 36 H36 V42 Q32 45 28 42Z" fill={SHADE} />
      {turtleneck && <rect x="26.6" y="38" width="10.8" height="10.5" rx="3" fill={outfit} />}
      {/* oreilles, tête */}
      <circle cx="21" cy="31.5" r="2.5" fill={skin} />
      <circle cx="43" cy="31.5" r="2.5" fill={skin} />
      <ellipse cx="32" cy="29" rx="11" ry="13" fill={skin} />
      <Face style={s.face} />
      {hairFront(s.hair, hair)}
      <Accessory style={s.accessory} tint={outfit} />
    </svg>
  );
}
