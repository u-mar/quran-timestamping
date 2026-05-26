export type Chapter = {
  id: number;
  nameArabic: string;
  nameSimple: string;
  versesCount: number;
};

export type Ayah = {
  key: string;
  surah: number;
  ayah: number;
  text: string;
};

export type Timestamp = {
  key: string;
  surah: number;
  ayah: number;
  start: number;
  end?: number;
  text: string;
};

export type AyahRange = {
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
};

type QuranApiChapter = {
  id: number;
  name_arabic: string;
  name_simple: string;
  verses_count: number;
};

type QuranApiVerse = {
  verse_key: string;
  text_uthmani: string;
};

const QURAN_API_BASE = "https://api.quran.com/api/v4";

export const defaultRange: AyahRange = {
  startSurah: 1,
  startAyah: 1,
  endSurah: 1,
  endAyah: 7,
};

export function makeAyahKey(surah: number, ayah: number) {
  return `${surah}:${ayah}`;
}

export function compareAyahPosition(
  left: Pick<Ayah, "surah" | "ayah">,
  right: Pick<Ayah, "surah" | "ayah">,
) {
  return left.surah === right.surah ? left.ayah - right.ayah : left.surah - right.surah;
}

export async function loadChapters(): Promise<Chapter[]> {
  const response = await fetch(`${QURAN_API_BASE}/chapters?language=en`);

  if (!response.ok) {
    throw new Error("Could not load Quran chapters.");
  }

  const payload = (await response.json()) as { chapters: QuranApiChapter[] };

  return payload.chapters.map((chapter) => ({
    id: chapter.id,
    nameArabic: chapter.name_arabic,
    nameSimple: chapter.name_simple,
    versesCount: chapter.verses_count,
  }));
}

export async function loadAyahsForRange(range: AyahRange): Promise<Ayah[]> {
  const surahs = Array.from(
    { length: range.endSurah - range.startSurah + 1 },
    (_, index) => range.startSurah + index,
  );

  const ayahsBySurah = await Promise.all(
    surahs.map(async (surah) => {
      const response = await fetch(
        `${QURAN_API_BASE}/quran/verses/uthmani?chapter_number=${surah}`,
      );

      if (!response.ok) {
        throw new Error(`Could not load Surah ${surah}.`);
      }

      const payload = (await response.json()) as { verses: QuranApiVerse[] };

      return payload.verses
        .map<Ayah>((verse) => {
          const [, ayahPart] = verse.verse_key.split(":");
          const ayah = Number(ayahPart);

          return {
            key: makeAyahKey(surah, ayah),
            surah,
            ayah,
            text: verse.text_uthmani,
          };
        })
        .filter((ayah) => {
          if (ayah.surah === range.startSurah && ayah.ayah < range.startAyah) {
            return false;
          }

          if (ayah.surah === range.endSurah && ayah.ayah > range.endAyah) {
            return false;
          }

          return true;
        });
    }),
  );

  return ayahsBySurah.flat().sort(compareAyahPosition);
}
