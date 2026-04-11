# Graph Query Ideas

Notes from a conversation about graph databases and the musicians domain.
These assume a graph DB layer (e.g. Neo4j) synced from Postgres.

---

## The core insight

The musicians domain is essentially a narrowly-scoped LinkedIn with well-defined roles
(Musician, Promoter, Engineer). Relationships have meaningful types — *played with*,
*engineered for*, *promoted by*, *booked at* — which makes the network far more useful
than a generic "connected" model.

---

## Entity model (from MUS-6)

```
User (1-to-many) → Role
  Musician  → many-to-many → Band
  Promoter  → many-to-many → PromoterGroup → many-to-many → Venue
  Engineer  → many-to-many → RecordingStudio
            → many-to-many → LiveAudioGroup
```

**Gig** as a reified relationship (first-class entity):
```
(Musician)-[:PARTICIPATED_IN]->(Gig)-[:FOR_BAND]->(Band)
                                    -[:AT_VENUE]->(Venue)
                                    -[:PROMOTED_BY]->(Promoter)
                                    -[:TYPE]->("session" | "live" | "permanent")
```

---

## Membership types

Rather than a simple band membership, model participation with context:

```cypher
// Permanent member
(m:Musician)-[:PLAYED_FOR {type: "permanent", since: "2020-01"}]->(b:Band)

// Session musician
(m:Musician)-[:PLAYED_FOR {type: "session", date: "2024-03"}]->(b:Band)

// Studio session
(m:Musician)-[:PARTICIPATED_IN]->(Session)-[:AT_STUDIO]->(s:RecordingStudio)
```

---

## Network / discovery queries

### Find bands via a promoter at a venue
```cypher
MATCH (b:Band {genre: "heavy metal"})
      -[:PLAYED_AT]->(:Gig)
      -[:PROMOTED_BY]->(:Promoter)
      -[:WORKS_FOR]->(:Venue {name: "The Forum"})
RETURN b
```

### Shortest path introduction (LinkedIn-style)
"How am I connected to Abbey Road Studios?"
```cypher
MATCH path = shortestPath(
  (m:Musician {name: "John"})-[*]-(s:RecordingStudio {name: "Abbey Road"})
)
RETURN path
```
Returns the chain of people/entities to reach out through, e.g.:
> John → (member of) → The Blinders → (engineered by) → Dave → (works at) → Abbey Road

### All paths, not just shortest
Useful when you want to pick who to approach based on relationship strength:
```cypher
MATCH path = allShortestPaths(
  (m:Musician {name: "John"})-[*]-(s:RecordingStudio {name: "Abbey Road"})
)
RETURN path
```

### Variable-depth traversal
"Find everything reachable from this band within 3 hops":
```cypher
MATCH (b:Band {name: "The Blinders"})-[:CONNECTED_TO*1..3]->(n)
RETURN n
```

---

## Promoter matchmaking

### Find available metal bands for a venue this weekend
```cypher
MATCH (b:Band {genre: "metal"})
WHERE NOT EXISTS {
  MATCH (b)-[:PARTICIPATED_IN]->(g:Gig)
  WHERE g.date = "2026-03-14"
}
AND (b)-[:PARTICIPATED_IN]->(:Gig)-[:AT_VENUE]->(:Venue {name: "Venue A"})
RETURN b
```

### Extended filters a promoter would want
- Bands within a certain radius of the venue
- Bands who've played venues of similar capacity
- Bands who've played with other acts on your roster (known quantity)
- Bands whose usual fee is within budget
- Bands recommended by engineers or promoters in your network

### Familiarity signal
```cypher
// Has this band played Venue A before?
MATCH (b:Band)-[:PARTICIPATED_IN]->(g:Gig)-[:AT_VENUE]->(v:Venue {name: "Venue A"})
RETURN b, count(g) AS previous_gigs
ORDER BY previous_gigs DESC
```

---

## Why graph over SQL for these queries

SQL requires an explicit JOIN per hop — you have to know the query shape at write time.
Graph traversal is flexible:

```cypher
// Variable depth — SQL has no clean equivalent
MATCH (b:Band)-[:CONNECTED_TO*1..5]->(v:Venue)
```

SQL equivalent requires recursive CTEs which get complex fast. For simple lookups
(show me a band's members, show me a venue's gigs) Postgres is fine and should remain
the source of truth. The graph layer earns its keep when queries traverse the network
in ways that aren't known in advance.

---

## Trust-weighted ratings

### The problem with raw averages
A 4.2 star rating from 500 strangers tells you little. But if someone you've done
10 gigs with rates an engineer highly, that means a lot. The source of the rating
matters as much as the rating itself.

### The model
The rating lives on the relationship, not the entity:

```cypher
(Musician)-[:WORKED_WITH {rating: 4, notes: "great ears, easy to work with"}]->(Engineer)
```

Trust is implicit from the existing graph — the stronger your working relationship
with the rater, the more their opinion is weighted when you look up that engineer.

### Personalised scores
Instead of showing a global average, compute:

> "People you've worked with rate them 4.6. People in your extended network rate them 3.8."

Two people looking at the same engineer could see different scores depending on their
position in the network.

### Key properties
- **No gaming** — ratings only surface through real working relationships, so you can't astroturf
- **Reciprocal** — both parties rate each other; a difficult musician surfaces that too
- **Private by default** — never show someone their own rating (like Uber's passenger ratings)
- **Emergent reputation** — highly trusted people in the network become taste-makers whose opinions carry more weight

### Explicit trust endorsement
Beyond implicit trust (derived from how much you've worked together), users could
explicitly mark someone as a trusted reference — directional and domain-specific,
like a LinkedIn recommendation but with weight.

### Rating by genre
Filter ratings by a property of the rater — useful for seeing how good an engineer
is at recording/mixing different styles:

```cypher
MATCH (b:Band {genre: "funk"})-[r:WORKED_WITH]->(e:Engineer {name: "Dave"})
RETURN avg(r.rating) AS funk_rating

MATCH (b:Band {genre: "metal"})-[r:WORKED_WITH]->(e:Engineer {name: "Dave"})
RETURN avg(r.rating) AS metal_rating
```

An engineer might be a 4.8 in the studio for jazz but a 3.1 live for metal. A flat
average completely obscures this. You could break it down further by role (live vs
studio), venue size, or any other property on the rater or the relationship.

### PageRank analogy
This is essentially **PageRank applied to a trust graph**. Google's insight was that
a link from a trusted site is worth more than a link from an unknown one. Same principle:
a rating from someone your network trusts is worth more than a rating from a stranger.

---

## Natural language query interface (text-to-Cypher)

Users type free text which is converted to a Cypher query via an LLM API call.

```
User types: "find me available funk engineers who my bandmates have worked with"
     ↓
LLM (with schema in system prompt)
     ↓
Cypher query
     ↓
Graph DB
     ↓
Results rendered in UI
```

### Why it works well here
- Schema is small and stable — the LLM only needs to know a handful of node and relationship types
- Queries follow predictable patterns (traversal, filtering, aggregation)
- Domain language maps cleanly to schema: "bands I've played with" →
  `(me)-[:PARTICIPATED_IN]->(:Gig)<-[:PARTICIPATED_IN]-(b:Band)`

### System prompt should include
- Node types and their properties
- Relationship types and their properties
- A few example queries (few-shot prompting)
- The current user's ID so the LLM can anchor queries to "me"

### Guardrails
- Read-only — only allow `MATCH`/`RETURN`, reject any query containing `CREATE`/`MERGE`/`DELETE`/`SET`
- Validate the generated query before running it
- Fallback gracefully when the query returns nothing ("no results" vs "query failed")

### UX consideration
Show or hide the generated query? Showing it builds trust and lets power users
refine it. Hiding it feels more magical but less transparent. Could offer both —
hide by default with a "show query" option.

### Implementation
Just an LLM API call — no fine-tuning or training required. The narrow domain
makes it more reliable than a generic implementation because the LLM has less
ambiguity to resolve. See the claude-api skill for implementation guidance.

---

## Potential product feature

This stops being just queries and starts looking like a **matchmaking engine**:
a promoter opens the app, says "I need a metal band for Saturday at Venue A",
and gets a ranked shortlist with reasons — previous gigs at the venue, network
connections, availability, capacity fit. That's a core product value that falls
naturally out of this data model.
