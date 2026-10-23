/** The note about a failed action - the panel is gray, the note is not red. */
export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-300">
      {message}
    </p>
  );
}
