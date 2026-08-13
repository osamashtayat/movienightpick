const shareHandler = require("../../api/share");

const { requestOrigin, shareDocument } = shareHandler.__test;

test("creates a branded rich preview with movie information", () => {
  const html = shareDocument({
    movie: {
      id: 278,
      title: "The Shawshank Redemption",
      release_date: "1994-09-23",
      imdbRating: 9.3,
      overview: "Two imprisoned men bond over a number of years.",
      genres: [{ name: "Drama" }],
    },
    movieId: 278,
    origin: "https://movienightpick.vercel.app",
  });

  expect(html).toContain("The Shawshank Redemption (1994) — MovieNightPick");
  expect(html).toContain("IMDb 9.3 • Drama • Two imprisoned men bond over a number of years.");
  expect(html).toContain("https://movienightpick.vercel.app/share-preview.png");
  expect(html).toContain("https://movienightpick.vercel.app/?movie=278");
  expect(html).not.toContain("react");
});

test("uses forwarded deployment details to build the public origin", () => {
  expect(requestOrigin({
    headers: {
      "x-forwarded-host": "preview.example.com",
      "x-forwarded-proto": "https",
    },
  })).toBe("https://preview.example.com");

  expect(requestOrigin({
    headers: { "x-forwarded-host": "bad-host.example.com/\"onload=alert(1)" },
  })).toBe("https://movienightpick.vercel.app");
});
