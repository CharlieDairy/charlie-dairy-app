// The stamp shown over an animal's photo when it has left the herd. It follows the animal's status, so setting an animal to
// SOLD or DEAD puts the stamp on its picture everywhere, and setting it back removes it. The stored photo itself is never changed.

export type Watermark = { text: string; tone: "sold" | "dead" };

export function watermarkFor(status: string | null | undefined): Watermark | null {
  switch ((status ?? "").toUpperCase()) {
    case "SOLD":
      return { text: "SOLD", tone: "sold" };
    case "DEAD":
    case "DECEASED":
    case "DEATH":
      return { text: "DEAD", tone: "dead" };
    default:
      return null;
  }
}
