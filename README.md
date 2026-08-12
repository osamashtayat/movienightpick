# MovieNightPick

**Spend less time browsing and more time watching.**

MovieNightPick is a movie-discovery app that gives you one recommendation based on what you actually want to watch—including genre, IMDb rating, release period, runtime, language, and discovery style.

**Live website:** [movienightpick.vercel.app](https://movienightpick.vercel.app/)

## Why MovieNightPick?

Choosing a movie can sometimes take longer than watching one, especially after you have already seen many of the popular recommendations. Searching through endless lists often leads to repeated suggestions and decision fatigue.

MovieNightPick solves this small but frustrating problem by turning your preferences into one clear recommendation. It can suggest popular choices, less obvious hidden gems, or unpredictable wild cards while checking that the movie meets your requested IMDb rating.

The goal is simple: **help you find tonight's movie quickly.**

## Features

- Combine multiple genres and filter by IMDb rating, release dates, runtime, and original language
- Choose between crowd-pleaser, hidden-gem, and wild-card discovery modes
- Verify IMDb ratings through MDBList before recommending a movie
- Watch trailers and open available streaming platforms
- Save favorites, review recent picks, and avoid repeated recommendations
- Share movies and enjoy a responsive interface on desktop or mobile

## How It Works

1. Choose your movie preferences.
2. MovieNightPick searches TMDB for matching movies and uses MDBList to verify their IMDb ratings.
3. A qualifying movie is displayed with its poster, description, cast, trailer, and available streaming information.

## Running Locally

You will need:

- Node.js and npm
- A TMDB API key
- An MDBList API key

Install the project:

```bash
npm install
```

Create a `.env.local` file in the project folder:

```env
TMDB_API_KEY=your_tmdb_key
MDBLIST_API_KEY=your_mdblist_key
```

Keep these keys private and do not expose them in frontend code.

Start the project through Vercel so the movie API also works locally:

```bash
npx vercel dev
```

## Testing

Run the automated tests:

```bash
npm test -- --watchAll=false
```

Create a production build:

```bash
npm run build
```

## Deployment

Add `TMDB_API_KEY` and `MDBLIST_API_KEY` to the Vercel project's environment variables, then deploy with:

```bash
npx vercel --prod
```

## Data and Attribution

Movie discovery, artwork, metadata, trailers, and streaming-provider information use TMDB data. IMDb ratings and related metadata are verified through MDBList.

This project is not endorsed or certified by TMDB, MDBList, or IMDb.
