import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RoomBallot } from "./RoomBallot";

const movies = [
  {
    id: 1,
    title: "The First Choice",
    release_date: "2020-01-01",
    imdbRating: 8.2,
    runtime: 110,
    posterUrl: "https://image.example/one.jpg",
    overview: "First synopsis",
    genres: [{ id: 9648, name: "Mystery" }],
  },
  {
    id: 2,
    title: "The Second Choice",
    release_date: "2021-01-01",
    imdbRating: 7.9,
    runtime: 105,
    posterUrl: "https://image.example/two.jpg",
    overview: "Second synopsis",
    genres: [{ id: 53, name: "Thriller" }],
  },
];

function state(overrides = {}) {
  const { room: roomOverrides = {}, ...stateOverrides } = overrides;
  return {
    room: {
      code: "ABC234",
      status: "voting",
      candidates: movies,
      winnerIds: [],
      ...roomOverrides,
    },
    me: { id: "host", name: "Host", isHost: true },
    members: [
      { id: "host", name: "Host", isHost: true },
      { id: "guest", name: "Guest", isHost: false },
    ],
    voteCounts: { 1: 1, 2: 0 },
    totalVotes: 1,
    myVote: 1,
    ...stateOverrides,
  };
}

test("shows the group ballot and lets a member change their vote", () => {
  const onVote = jest.fn();
  render(
    <RoomBallot
      state={state()}
      isBusy={false}
      onVote={onVote}
      onReveal={jest.fn()}
      onReset={jest.fn()}
    />
  );

  expect(screen.getByRole("heading", { name: /choose the one/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /your vote/i })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: /vote for this/i }));
  expect(onVote).toHaveBeenCalledWith(2);
  expect(screen.getByRole("button", { name: /reveal the winner/i })).toBeEnabled();
});

test("clearly marks the winning movie after the host reveals it", () => {
  render(
    <RoomBallot
      state={state({ room: { status: "revealed", winnerIds: [1] } })}
      isBusy={false}
      onVote={jest.fn()}
      onReveal={jest.fn()}
      onReset={jest.fn()}
    />
  );

  expect(screen.getByRole("heading", { name: /tonight’s winner/i })).toBeInTheDocument();
  expect(screen.getByText(/^winner$/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /build a new ballot/i })).toBeEnabled();
  expect(screen.getAllByRole("link", { name: /view full movie/i })).toHaveLength(2);
});

test("keeps a failed member search beside successful voting cards", () => {
  render(
    <RoomBallot
      state={state({
        submissions: [{
          memberId: "guest",
          memberName: "Guest",
          status: "failed",
          error: "No IMDb 9.0+ western was found.",
        }],
      })}
      isBusy={false}
      onVote={jest.fn()}
      onReveal={jest.fn()}
      onReset={jest.fn()}
    />
  );

  expect(screen.getByText("No movie found")).toBeInTheDocument();
  expect(screen.getByText(/no imdb 9.0\+ western/i)).toBeInTheDocument();
  expect(screen.getByText(/doesn’t block the vote/i)).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /vote for this|your vote/i })).toHaveLength(2);
});
