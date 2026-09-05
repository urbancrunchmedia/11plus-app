// "Spot the spelling mistake" questions (GL/CEM style), same shape as
// punctuationSpot: each sentence is split into 4 sections (A–D). `answer` is the
// 0-based index of the section containing a misspelled word, or 4 for "no
// mistake" (N). `why` gives the correct spelling, shown as feedback.
export const spellingSpot = {
  A: [
    { segments: ["My freind", "came round", "to play", "after school."], answer: 0, why: "It's “friend” — fri-end." },
    { segments: ["We had", "beans on", "toast for", "our diner."], answer: 3, why: "The meal is “dinner”, with two n's." },
    { segments: ["The wether", "was sunny", "so we walked", "to the park."], answer: 0, why: "It's “weather” (with an a): wea-ther." },
    { segments: ["She could", "here the", "birds singing", "in the tree."], answer: 1, why: "Use “hear” (it has “ear”) for listening." },
    { segments: ["I have", "two sisters", "and one", "brother."], answer: 4, why: "No mistake — every word is spelled correctly." },
    { segments: ["He was", "very hapy", "with his", "new bike."], answer: 1, why: "“Happy” has two p's." },
    { segments: ["We saw", "a beutiful", "rainbow after", "the rain."], answer: 1, why: "It's “beautiful” — beau-ti-ful." },
    { segments: ["Please rember", "to bring", "your lunch", "tomorrow."], answer: 0, why: "It's “remember” — re-mem-ber." },
    { segments: ["The cat", "chased its", "tale around", "the garden."], answer: 2, why: "A cat has a “tail” (t-a-i-l)." },
    { segments: ["My favourite", "colour is", "a bright", "green."], answer: 4, why: "No mistake — every word is spelled correctly." },
  ],
  B: [
    { segments: ["We recieved", "a letter", "in the", "post today."], answer: 0, why: "“Received” — i before e except after c." },
    { segments: ["The libary", "on the high", "street closes", "at four."], answer: 0, why: "It's “library” — remember the first r: li-bra-ry." },
    { segments: ["It was", "definately", "the best", "day ever."], answer: 1, why: "“Definitely” has no a — de-fin-ite-ly." },
    { segments: ["She wore", "a beautifull", "dress to", "the party."], answer: 1, why: "“Beautiful” ends with one l." },
    { segments: ["They were", "seperated", "into two", "small teams."], answer: 1, why: "“Separated” — there's a rat in sep-a-rate." },
    { segments: ["The teacher", "gave us", "some homework", "tonight."], answer: 4, why: "No mistake — every word is spelled correctly." },
    { segments: ["He was", "embarassed", "by the", "loud noise."], answer: 1, why: "“Embarrassed” has two r's and two s's." },
    { segments: ["We visited", "a beautiful", "castle in", "Scotland."], answer: 4, why: "No mistake — every word is spelled correctly." },
    { segments: ["Our nieghbours", "have a", "new puppy", "next door."], answer: 0, why: "“Neighbours” — the neigh comes first: n-e-i-g-h." },
    { segments: ["She quickly", "finnished", "her book", "before bed."], answer: 1, why: "“Finished” has one n." },
  ],
  C: [
    { segments: ["The govenment", "announced a", "new plan", "yesterday."], answer: 0, why: "“Government” keeps the n: govern-ment." },
    { segments: ["It was", "a mischievous", "little", "puppy."], answer: 4, why: "No mistake — “mischievous” is correct." },
    { segments: ["The restarant", "served the", "most delicious", "food."], answer: 0, why: "“Restaurant” — res-tau-rant." },
    { segments: ["She made", "an embarrassing", "mistake during", "the speech."], answer: 4, why: "No mistake — every word is spelled correctly." },
    { segments: ["They had", "a seperate", "entrance for", "the guests."], answer: 1, why: "“Separate” — there's a rat in it: sep-a-rate." },
    { segments: ["The medecine", "tasted awful", "but worked", "quickly."], answer: 0, why: "“Medicine” — medi-cine." },
    { segments: ["He gave", "a persuasive", "and convincing", "arguement."], answer: 3, why: "“Argument” has no e after the u." },
    { segments: ["We were", "concious of", "the time", "running out."], answer: 1, why: "“Conscious” has an s-c: con-scious." },
    { segments: ["The occassion", "called for", "a special", "outfit."], answer: 0, why: "“Occasion” has two c's but one s." },
    { segments: ["Her jewellery", "sparkled in", "the bright", "sunlight."], answer: 4, why: "No mistake — “jewellery” is the UK spelling." },
  ],
};
