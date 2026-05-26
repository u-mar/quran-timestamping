import TimestampEditor from "@/components/TimestampEditor";

type EditorPageProps = {
  params: Promise<{
    surahId: string;
  }>;
};

export default async function EditorPage({ params }: EditorPageProps) {
  const { surahId } = await params;
  const initialSurahId = Number(surahId);

  return <TimestampEditor initialSurahId={initialSurahId} />;
}
