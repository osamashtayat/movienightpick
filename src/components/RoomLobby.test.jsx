import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RoomLobby } from "./RoomLobby";

const state = {
  room: { code: "ABC234", status: "lobby", hostName: "Host" },
  me: { id: "host", name: "Host", isHost: true },
  members: [
    { id: "host", name: "Host", isHost: true },
    { id: "maya", name: "Maya", isHost: false },
    { id: "sam", name: "Sam", isHost: false },
    { id: "lee", name: "Lee", isHost: false },
  ],
  submissions: [
    {
      memberId: "host",
      memberName: "Host",
      isMe: true,
      status: "success",
      movie: {
        id: 1,
        title: "Mystery Pick",
        imdbRating: 8.1,
        imdbVotes: 123456,
        release_date: "2020-01-01",
        overview: "A detective follows a trail that refuses to make sense.",
      },
      filters: { genres: ["9648"], minimumRating: 8 },
    },
    {
      memberId: "maya",
      memberName: "Maya",
      isMe: false,
      status: "success",
      movie: { id: 2, title: "Comedy Pick", imdbRating: 7.6, release_date: "2021-01-01" },
      filters: { genres: ["35"], minimumRating: 7.5 },
    },
    {
      memberId: "sam",
      memberName: "Sam",
      isMe: false,
      status: "failed",
      error: "No movie matched Sam’s narrow filters.",
      filters: { genres: ["37"], minimumRating: 9 },
    },
  ],
};

test("shows every member's independent result and allows voting despite one failure", () => {
  const onStartVote = jest.fn();
  render(
    <RoomLobby
      state={state}
      isSearching={false}
      isBusy={false}
      onStartVote={onStartVote}
      onShare={jest.fn()}
    />
  );

  expect(screen.getByText("Mystery Pick")).toBeInTheDocument();
  expect(screen.getByText("A detective follows a trail that refuses to make sense.")).toBeInTheDocument();
  expect(screen.getByText("123,456")).toBeInTheDocument();
  expect(screen.getAllByText("IMDb voters")).toHaveLength(2);
  expect(screen.getByText("Comedy Pick")).toBeInTheDocument();
  expect(screen.getByText(/we couldn’t find sam’s movie/i)).toBeInTheDocument();
  expect(screen.getByText(/choosing preferences/i)).toBeInTheDocument();
  expect(screen.getByText("3/4")).toBeInTheDocument();

  const startButton = screen.getByRole("button", { name: /start voting with 2 movies/i });
  expect(startButton).toBeEnabled();
  fireEvent.click(startButton);
  expect(onStartVote).toHaveBeenCalledTimes(1);
});

test("shows a live search card only for the current participant", () => {
  render(
    <RoomLobby
      state={state}
      isSearching
      isBusy={false}
      onStartVote={jest.fn()}
      onShare={jest.fn()}
    />
  );

  expect(screen.getByText(/searching their corner of movie night/i)).toBeInTheDocument();
  expect(screen.getByText("Comedy Pick")).toBeInTheDocument();
});
