const ACTION = {
    COUNT_ROUND: "@Runde",
    TRANSFER: ">Stimmtransfer",
    ELIMINATE: "-Team mit den geringsten Stimmen ausschließen",
    QUOTA: "!QUOTA",
    ELECT: "+Team mit Stimmen größer gleich Quote zuteilen",
    COUNT: ".Aktuelle Stimmenverteilung",
    ZOMBIES: "~ZOMBIES",
    RANDOM: "*Gleichstand - Losentscheidung",
    THRESHOLD: "Mindestanzahl Stimmen um gewählt zu werden (Droop-Quote)"
};
const ballotSeparator = "\n";
const voteSeparator = ",";

const TEAMS = [
    "Rigor Mortis",
    "Seven Sins",
    "Zonenkinder",
    "Munich Monks",
    "NLG",
    "Peters Pawns",
    "HaWu AllstarZ",
    "Falco jugger",
    "Leipziger Nachtwache",
    "Pompfenbrecher",
    "Jugger Basilisken Basel",
    "Schergen von Monasteria",
    "Flying JUGGmen Bonn",
    "Jugger Helden Bamberg",
    "Grünanlagen Guerilla",
    "Hobbiz",
    "Blue Fangs",
    "Fischkoppkrieger",
    "Rigor Mortis 2",
    "ProblemMachine",
    "Problemkinder",
    "Schatten",
    "Lokomotive Black Ninja",
    "Bob Jugger",
    "Likedeeler",
    "Anima Equorum",
    "Pink Pain",
    "Collapse",
    "Jumping Juggmen",
    "Wütende Tintenfische",
    "The Fellowship",
    "Nordische Sport Amatuere (NSA)",
    "Cranium ex Machina",
    "Skull!",
    "Sloth Machine",
    "Amazonenkinder",
    "Grimm Racoons",
    "Potsdamer Piranhas",
    "Nightfox Bonn",
    "Blutgruppe Nord",
];

const VOTES_PER_TEAM = 8;

function runStv() {
    // Transform input
    const ballots = document.getElementById("csvInput").value.trim().split(ballotSeparator).map(ballotTxt => {
        return new Ballot(ballotTxt.trim().split(voteSeparator).map(voteTxt => voteTxt.trim()).filter(vote => vote))
    }).filter(ballot => ballot.candidates.length > 0);

    const seats = parseInt(document.getElementById("seat").value);
    document.getElementById("inputBox").innerHTML = "";
    document.getElementById("output").style.display = "block";

    const threshold = 1 + ((ballots.length * VOTES_PER_TEAM) / (seats + 1)); // Droop quota
    output("Anzahl Stimmen", (ballots.length * VOTES_PER_TEAM) + " von " + ballots.length + " Stimmberechtigten Teams" );
    output("Anzahl Startplätze", seats);
    output(ACTION.THRESHOLD, threshold);

    let allocated = {}; // The allocation of ballots to candidates
    let voteCount = {} // A hash of ballot counts, indexed by candidates
    let candidates = [] // All candidates
    let elected = [] // The candidates that have been elected
    let hopefuls; // The candidates that may be elected
    let eliminated = [] // The candidates that have been eliminated because of low counts

    console.log(ballots);
    // Initial count
    for (const ballot of ballots) {
        for (const candidate of ballot.candidates) {
            if (!candidates.includes(candidate)) {
                candidates.push(candidate);
                voteCount[candidate] = 0;
            }
            if (!allocated.hasOwnProperty(candidate)) {
                allocated[candidate] = [];
            }
        }
        for (let i = 0; i < VOTES_PER_TEAM; i++) {
            const selected = ballot.candidates[i];
            const partialBallot = new PartialBallot(ballot);
            allocated[selected].push(partialBallot);
            voteCount[selected]++;
        }
        ballot.currentPreference = VOTES_PER_TEAM;
    }
    hopefuls = candidates; // In the beginning, all candidates are hopefuls

    // Start rounds
    let currentRound = 1;
    let numElected = elected.length;
    let numHopefuls = hopefuls.length;
    while (numElected < seats && numHopefuls > 0) {
        emtpyRow();
        output(ACTION.COUNT_ROUND, currentRound);
        hopefuls.sort((hopeful1, hopeful2) => voteCount[hopeful2] - voteCount[hopeful1]);
        output(ACTION.COUNT, countDescription(voteCount, hopefuls));

        // If there is a surplus record it so that we can try to redistribute
        // the best candidate's votes according to their next preferences
        const surplus = voteCount[hopefuls[0]] - threshold;
        // If there is either a candidate with surplus votes, or
        // there are hopeful candidates beneath the threshold.
        if (surplus >= 0 || numHopefuls <= (seats - numElected)) {
            const bestCandidate = randomlySelectFirst(hopefuls, voteCount, ACTION.ELECT);
            if (!hopefuls.includes(bestCandidate)) {
                alert("Kein valides team: " + bestCandidate);
            }
            hopefuls = hopefuls.filter(hopeful => hopeful !== bestCandidate); // Remove from hopefuls

            // Elect
            elected.push([bestCandidate, currentRound, voteCount[bestCandidate]]);
            output(ACTION.ELECT, bestCandidate + " = " + voteCount[bestCandidate]);

            if (surplus > 0) {
                // Calculate the weight for this round
                const weight = surplus / voteCount[bestCandidate];
                // Find the next eligible preference for each one of the ballots
                // cast for the candidate, and transfer the vote to that
                // candidate with its value adjusted by the correct weight.
                allocated = redistributeBallots(bestCandidate, weight, hopefuls, allocated, voteCount);
            }
        } else {
            // If nobody can get elected, take the least hopeful candidate
            // (i.e., the hopeful candidate with the less votes) and redistribute that candidate's votes.
            hopefuls.reverse();
            const worstCandidate = randomlySelectFirst(hopefuls, voteCount, ACTION.ELIMINATE);
            hopefuls = hopefuls.filter(hopeful => hopeful !== worstCandidate);
            eliminated.push(worstCandidate);
            output(ACTION.ELIMINATE, worstCandidate + " = " + voteCount[worstCandidate]);
            allocated = redistributeBallots(worstCandidate, 1, hopefuls, allocated, voteCount);
        }
        currentRound++;
        numHopefuls = hopefuls.length;
        numElected = elected.length;
    }

    while ((seats - numElected) > 0 && eliminated.length > 0) {
        // If there is either a candidate with surplus votes,
        // or there are hopeful candidates beneath the threshold.
        output(ACTION.COUNT, currentRound);
        output(ACTION.ZOMBIES, countDescription(voteCount, eliminated));
        const bestCandidate = eliminated.pop();

        // Elect
        elected.push([bestCandidate, currentRound, voteCount[bestCandidate]]);
        output(ACTION.ELECT, bestCandidate + " = " + voteCount[bestCandidate]);
        currentRound++;
    }

    output('', '');
    for (const e of elected) {
        output("***Platz zugeteilt", e[0] + " in Runde " + e[1] + " mit " + e[2] + " Stimmen");
    }
}

function emtpyRow() {
    document.getElementById("output").innerHTML += "<div><br/></div>";
}

function output(tag, description) {
    document.getElementById("output").innerHTML += "<div><b>" + tag + "</b>&emsp;" + description + "</div>";
}

function countDescription(voteCount, hopefuls) {
    return hopefuls.map(hopeful => {
        return hopeful + " = " + voteCount[hopeful].toFixed(3);
    }).join(", ");
}

function randomlySelectFirst(sequence, key, action) {
    /* Selects the first item of equals in a sorted sequence of items.

    For the given sorted sequence, returns the first item if it
    is different than the second; if there are ties so that there
    are items with equal values, it randomly selects among those items.
    The value of each item in the sequence is provided by applying the
    function key to the item. The action parameter indicates the context
    in which the random selection takes place (election or elimination).
    random_generator, if given, is the function that produces the random
    selection. */
    const firstValue = key[sequence[0]];
    const collected = [];
    for (const candidate of sequence) {
        if (key[candidate] === firstValue) {
            collected.push(candidate);
        } else {
            break;
        }
    }
    let selected = collected[0];
    const numEligibles = collected.length;
    if (numEligibles > 1) {
        selected = randomArrayMember(collected);
        output(ACTION.RANDOM, selected + " aus dem Set (" + collected.join(', ') + ") gewählt für: " + action)
    }
    return selected;
}

function randomArrayMember(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function redistributeBallots(selected, weight, hopefuls, allocated, voteCount) {
    const transferred = [];
    // Keep a hash of ballot moves for logging purposes.
    // Keys are a tuple of the form (from_recipient, to_recipient, value)
    // where value is the current value of the ballot. Each tuple points
    // to the ballot being moved.
    const moves = {};

    for (const partialBallot of allocated[selected]) {

        let i = partialBallot.ballot.currentPreference;
        partialBallot.addWeight(weight);
        var currentValue = partialBallot.getValue();
        var recipient = partialBallot.ballot.candidates[i];
        // Wenn der aktuelle Recipient selbst gewählt wurde, dann gehen wir direkt eine Präferenz weiter.
        if (!hopefuls.includes(recipient)) {
            partialBallot.ballot.remainingPartialVote = 1;
            do {
                i++;
               
                partialBallot.ballot.currentPreference++;
                recipient = partialBallot.ballot.candidates[i];
            } while (!hopefuls.includes(recipient) && i < partialBallot.ballot.candidates.length);
            if (i >= partialBallot.ballot.candidates.length) {
                continue;
            }
        }
        const remainingValue = partialBallot.ballot.remainingPartialVote;
        const newVal = Math.min(remainingValue,currentValue);
        partialBallot.ballot.remainingPartialVote -= newVal;
        const remainingValueBallot = new PartialBallot(partialBallot.ballot);
        remainingValueBallot.addWeight(newVal);
        if (allocated.hasOwnProperty(recipient)) {
            allocated[recipient].push(remainingValueBallot);
        } else {
            allocated[recipient] = [remainingValueBallot];
        }
        if (voteCount.hasOwnProperty(recipient)) {
            voteCount[recipient] += currentValue;
        } else {
            voteCount[recipient] = currentValue;
        }
        voteCount[selected] -= currentValue;
        const move = [selected, recipient, newVal].join(" #!# ");
        if (moves.hasOwnProperty(move)) {
            moves[move].push(remainingValueBallot);
        } else {
            moves[move] = [remainingValueBallot];
        }
        transferred.push(remainingValueBallot);

        if (0 < partialBallot.ballot.remainingPartialVote) {
            continue;
        }
        
        partialBallot.ballot.remainingPartialVote = 1;
        partialBallot.ballot.currentPreference++;
        i++;

        currentValue = remainingValue - newVal;
        if (0 === currentValue) {
            continue;
        }
        
        // Problem ist ggf. dass der recipient gerade an sich selbst verteilt.
        while (i < partialBallot.ballot.candidates.length) {
            recipient = partialBallot.ballot.candidates[i];
            
            if (hopefuls.includes(recipient)) {
                const newPartialBallot = new PartialBallot(partialBallot.ballot);
                newPartialBallot.addWeight(currentValue);
                allocated[recipient].push(newPartialBallot);

                if (allocated.hasOwnProperty(recipient)) {
                    allocated[recipient].push(newPartialBallot);
                } else {
                    allocated[recipient] = [newPartialBallot];
                }
                if (voteCount.hasOwnProperty(recipient)) {
                    voteCount[recipient] += currentValue;
                } else {
                    voteCount[recipient] = currentValue;
                }
                voteCount[selected] -= currentValue;
                partialBallot.ballot.currentPreference = i;
                const move = [selected, recipient, currentValue].join(" #!# ");
                if (moves.hasOwnProperty(move)) {
                    moves[move].push(newPartialBallot);
                } else {
                    moves[move] = [newPartialBallot];
                }
                transferred.push(newPartialBallot);
                break;
            } else {
                i++;
            }
        }
    }
    for (const moveKey in moves) {
        const ballots = moves[moveKey];
        const times = ballots.length;
        const move = moveKey.split(" #!# ");
        output(ACTION.TRANSFER, "von " + move[0] + " zu " + move[1] + " " + times + "*" + parseFloat(move[2]).toFixed(3) + "=" + (times * parseFloat(move[2])).toFixed(3));
    }
    allocated[selected] = allocated[selected].filter(ballot => !transferred.includes(ballot));
    return allocated;
}

// function addPartialBallotToNextRecipient(partialBallot) {

// }

function generate() {
    let countTeams = document.getElementById("anmeldungenCount").value;
    let teams = _.sampleSize(TEAMS, countTeams);
    let result = '';
    teams.forEach(function(team) {
        let teamsClone = _.clone(teams);
        teamsClone = _.remove(teamsClone, function(n) {
            return n !== team;
          });
          teamsClone = _.shuffle(teamsClone);
          result = result + teamsClone.join(',') + '\n';
    });
    document.getElementById("csvInput").value = result;

}

class Ballot {
    candidates = [];
    currentPreference = 0;
    remainingPartialVote = 1;

    constructor(candidates = []) {
        this.candidates = candidates;
    }
}

class PartialBallot {
    weights = [1.0];
    _value = 1.0;

    constructor(ballot) {
        this.ballot = ballot;
    }

    addWeight(weight) {
        this.weights.push(weight);
        this._value *= weight;
    }

    getValue() {
        return this._value;
    }
}

document.getElementById("generate").onclick = function() {
    if (document.getElementById("anmeldungenCount").value) {
        generate();
    } else {
        M.toast({html: "Bitte fülle die Felder aus"});
    }
}

document.getElementById("first-start").onclick = function () {
    if (document.getElementById("seat").value && document.getElementById("csvInput").value) {
        runStv();
    } else {
        M.toast({html: "Bitte fülle die Felder aus"});
    }
}
