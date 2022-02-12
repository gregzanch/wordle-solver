import { readFileSync } from "fs";
import inquirer from "inquirer";
import chalk from "chalk";

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function* getPlacementCombinations() {
  for (let i = 0; i < 242; i++) {
    yield i.toString(3).padStart(5, "0").split("");
  }
}

const PRECISION = 5;
const WORD_LIST = readJSON("res/possible-word-list.json").words;
let currentWordList = [...WORD_LIST];
const INITIAL_GUESSES = readJSON("res/initial-guesses.json");
const POSSIBLE_PLACEMENTS = Array.from(getPlacementCombinations());
const top50 = INITIAL_GUESSES.slice(0, 50);
const random10 = shuffle(top50).slice(0, 10);

function getIndicesOf(target, array) {
  return array.reduce((acc, curr, index) =>
    curr === target ? [...acc, index] : acc
  , []);
}

function getProbability(targetWord, placement, wordList = WORD_LIST) {
  const grayIndices = getIndicesOf("0", placement);
  const yellowIndices = getIndicesOf("1", placement);
  const greenIndices = getIndicesOf("2", placement);

  const filteredList = wordList.filter((word) => {
    const greenFilter = greenIndices.every(
      (index) => targetWord[index] === word[index]
    );
    const grayFilter = grayIndices.every(
      (index) => !word.includes(targetWord[index])
    );
    const yellowFilter = yellowIndices.every((index) => {
      // return if the word doesnt contain the misplaced character
      if (!word.includes(targetWord[index])) {
        return false;
      }
      // return if the misplaced character is not actually misplaced
      if (greenIndices.includes(word.indexOf(targetWord[index]))) {
        return false;
      }
      // if the two characters are the same then it's not a misplaced character
      if (word[index] === targetWord[index]) {
        return false;
      }
      return true;
    });
    return greenFilter && grayFilter && yellowFilter;
  });

  return {
    filteredList,
    probability: filteredList.length / wordList.length,
  };
}

function expectedValue(targetWord, wordList = WORD_LIST) {
  let sum = 0;
  for (const placement of POSSIBLE_PLACEMENTS) {
    const prob = getProbability(targetWord, placement, wordList).probability;
    if (prob === 0) {
      continue;
    }
    sum += prob * Math.log2(1 / prob);
  }
  return sum;
}

function ask() {
  inquirer
    .prompt([
      {
        type: "input",
        name: "word",
        message: "Enter your guess:",
      },
      {
        type: "input",
        name: "placements",
        message: "Enter placement map (gray: 0, yellow: 1, green: 2)",
      },
      {
        type: "confirm",
        name: "logPossibleMatches",
        message: "Want to log ALL the possible matches?",
        default: false,
      },
    ])
    .then((answers) => {
      if (answers.word.length !== 5) {
        console.log("Word must be 5 letters long!");
        return;
      }
      if (answers.placements.length !== 5) {
        console.log("Placement must be 5 letters long!");
        return;
      }
      if (!answers.placements.match(/[012]{5}/gim)) {
        console.log("Wrong syntax for placement");
        return;
      }

      const { filteredList, probability } = getProbability(
        answers.word,
        answers.placements.split(""),
        currentWordList
      );
      console.log("\n");
      console.log(
        chalk.green("Possible Matches:".padEnd(18, " ")),
        chalk.blue("n = ".padStart(8, " ")),
        chalk.yellow(filteredList.length)
      );
      console.log(
        chalk.green("Probability:".padEnd(18, " ")),
        chalk.blue("p(x) = ".padStart(8, " ")),
        chalk.yellow(probability.toFixed(PRECISION))
      );
      console.log(
        chalk.green("Expected Value:".padEnd(18, " ")),
        chalk.blue("E(x) = ".padStart(8, " ")),
        chalk.yellow(
          expectedValue(answers.word, currentWordList).toFixed(PRECISION)
        )
      );
      console.log("\n");
      let expectedValues = filteredList
        .map((w) => [w, expectedValue(w, currentWordList)])
        .sort((a, b) => b[1] - a[1]);
      if (!answers.logPossibleMatches) {
        expectedValues = expectedValues.slice(0, 10);
      }
      console.log(
        expectedValues
          .map((e) => `${e[0]} - ${chalk.yellow(e[1].toFixed(PRECISION))}`)
          .join("\n")
      );
      console.log("\n");
      currentWordList = [...filteredList];
    })
    .finally(() => ask());
}

export default function main() {
  console.clear();
  console.log(chalk.green("Best First Words:\n"));
  console.log(
    random10
      .map(
        ([word, expectedValue]) =>
          `${word} - ${chalk.yellow(expectedValue.toFixed(PRECISION))}`
      )
      .join("\n")
  );
  console.log("\n");
  ask();
}
