// "Spot the punctuation mistake" questions (GL/CEM style).
// Each sentence is split into 4 sections (A–D). `answer` is the 0-based index
// of the section with the punctuation error, or 4 for "no mistake" (N).
// `why` explains the rule, shown as feedback.
export const punctuationSpot = {
  A: [
    { segments: ["the cat sat", "quietly on", "the warm", "windowsill."], answer: 0, why: "A sentence must start with a capital letter — “The”." },
    { segments: ["I packed", "apples oranges", "and bananas", "for the trip."], answer: 1, why: "List items are separated by commas: “apples, oranges”." },
    { segments: ["Can we", "please go", "to the park", "today"], answer: 3, why: "A question ends with a question mark." },
    { segments: ["Dont forget", "to bring", "your coat", "tomorrow."], answer: 0, why: "“Don't” is a contraction and needs an apostrophe." },
    { segments: ["The children", "played happily", "in the", "sunny garden."], answer: 4, why: "This sentence is already correctly punctuated." },
    { segments: ["do you", "want to", "come to", "my party?"], answer: 0, why: "A sentence must start with a capital letter — “Do”." },
    { segments: ["We saw", "lions tigers", "and bears", "at the zoo."], answer: 1, why: "Separate list items with commas: “lions, tigers”." },
    { segments: ["Its going", "to rain", "later this", "afternoon."], answer: 0, why: "“It's” means “it is”, so it needs an apostrophe." },
    { segments: ["The tall", "giraffe reached", "the highest", "leaves."], answer: 4, why: "This sentence is already correctly punctuated." },
    { segments: ["What a", "brilliant goal", "that", "was"], answer: 3, why: "An exclamation ends with an exclamation mark." },
  ],
  B: [
    { segments: ["The dogs", "bone was", "buried under", "the tree."], answer: 0, why: "Singular possessive needs 's — “the dog's bone”." },
    { segments: ["Although it", "was raining", "we still", "went outside."], answer: 1, why: "Put a comma after a subordinate clause at the start: “raining,”." },
    { segments: ["She needed", "three things", "a pen a", "ruler and a rubber."], answer: 1, why: "Use a colon to introduce a list: “three things:”." },
    { segments: ["The girls", "changing rooms", "are down", "the corridor."], answer: 0, why: "Plural possessive: “the girls' changing rooms”." },
    { segments: ["We were", "tired but", "happy after", "the long walk."], answer: 4, why: "This sentence is already correctly punctuated." },
    { segments: ["He had", "just one", "goal", "to win."], answer: 2, why: "Use a colon to introduce an explanation: “one goal:”." },
    { segments: ["The childrens", "coats were", "left in", "the cloakroom."], answer: 0, why: "Irregular plural possessive: “children's”." },
    { segments: ["When the", "bell rang", "everyone rushed", "outside."], answer: 1, why: "Comma after the opening clause: “bell rang,”." },
    { segments: ["My uncle", "who lives", "in Leeds", "visited us."], answer: 1, why: "Non-essential clauses take commas: “uncle, who lives in Leeds,”." },
    { segments: ["The bakery", "sells fresh", "bread every", "morning."], answer: 4, why: "This sentence is already correctly punctuated." },
  ],
  C: [
    { segments: ["Slowly and", "carefully", "she lifted", "the ancient lid."], answer: 1, why: "Use a comma after a fronted adverbial: “carefully,”." },
    { segments: ["The weather", "was perfect", "we went", "to the beach."], answer: 2, why: "Two complete sentences need a semicolon or full stop, not just a join." },
    { segments: ["James's", "science project", "won first", "prize."], answer: 4, why: "This sentence is already correctly punctuated." },
    { segments: ["My favourite", "author Roald", "Dahl wrote", "many books."], answer: 1, why: "Commas go around an added detail (apposition): “author, Roald Dahl,”." },
    { segments: ["The old", "oak tree", "which we", "climbed fell down."], answer: 2, why: "A non-essential clause needs commas: “tree, which we climbed,”." },
    { segments: ["He whispered", "dont tell", "anyone about", "the plan."], answer: 1, why: "“Don't” is a contraction and needs an apostrophe." },
    { segments: ["She bought", "apples grapes", "and pears", "at the market."], answer: 1, why: "Separate list items with commas: “apples, grapes”." },
    { segments: ["After the", "long journey", "the travellers", "were exhausted."], answer: 1, why: "Comma after the opening phrase: “journey,”." },
    { segments: ["The scientists", "results were", "checked twice", "for errors."], answer: 0, why: "Possessive needs an apostrophe: “the scientist's results” (or “scientists'”)." },
    { segments: ["The garden", "was full", "of colourful", "spring flowers."], answer: 4, why: "This sentence is already correctly punctuated." },
  ],
};
