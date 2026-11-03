import { COLORS, SITE } from "./site";

// Social preview cards: the station sign above one row of the countdown board.
export const CARD = { width: 1200, height: 630 };

type Node = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
};

const el = (style: Record<string, unknown>, children: unknown): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

// Doto is wide, so long titles step down to stay within two lines.
export function titleSize(title: string): number {
  if (title.length <= 26) return 64;
  if (title.length <= 40) return 52;
  return 42;
}

// Three lines of description fit under the title; cut at a word, not mid-word.
export function shortDescription(text: string, max = 170): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "")}…`;
}

export function projectCard(data: {
  title: string;
  when: string;
  description: string;
}): Node {
  return el(
    {
      ...CARD,
      boxSizing: "border-box",
      flexDirection: "column",
      padding: "56px 96px",
      background: COLORS.wall,
      color: COLORS.white,
      fontFamily: "Overpass",
    },
    [
      el(
        { fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: -1 },
        SITE.name,
      ),
      el(
        {
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          marginTop: 40,
          padding: "44px 52px",
          borderRadius: 14,
          background: COLORS.board,
        },
        [
          el(
            {
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 40,
              fontFamily: "Doto",
              fontWeight: 900,
              color: COLORS.yellow,
              fontSize: titleSize(data.title),
              lineHeight: 1.1,
            },
            [el({ flex: 1 }, data.title), el({ flexShrink: 0 }, data.when)],
          ),
          el(
            {
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.4,
              color: COLORS.readout,
            },
            shortDescription(data.description),
          ),
        ],
      ),
    ],
  );
}
