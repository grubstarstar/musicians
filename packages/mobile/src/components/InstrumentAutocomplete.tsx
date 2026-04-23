import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { trpc } from "../trpc";

// MUS-68: debounced autocomplete backed by `instruments.search`.
//
// NOTE on the suspense convention deviation: CLAUDE.md mandates
// `useSuspenseQuery` inside a `<QueryBoundary>` for new tRPC screens. That
// pattern suits a single screen-level fetch; an autocomplete on a text
// input fires a fresh query on every keystroke and would thrash the
// suspense boundary (spinner on every letter). We intentionally use the
// non-suspense `useQuery` here with `placeholderData: keepPreviousData` so
// the dropdown keeps showing the previous match list while the next query
// settles. This is the one exception — don't copy the pattern into other
// screens without the same rationale.

const DEBOUNCE_MS = 200;

interface Suggestion {
  id: number;
  name: string;
  category: string | null;
}

export interface InstrumentAutocompleteProps {
  /** The currently-selected instrument id (or null if nothing's chosen). */
  value: number | null;
  /** The display text shown in the input. Usually the instrument's `name`
   *  for a committed selection, or whatever the user typed before confirming. */
  text: string;
  onChangeText: (text: string) => void;
  /** Called when the user taps a suggestion row. Passes id + name so the
   *  form can remember both and surface the name back in the input. */
  onSelect: (id: number, name: string) => void;
  /** Disables input + suggestion taps while the parent is submitting. */
  disabled?: boolean;
  placeholder?: string;
  testID?: string;
}

export function InstrumentAutocomplete({
  value,
  text,
  onChangeText,
  onSelect,
  disabled,
  placeholder = "e.g. Bass Guitar",
  testID,
}: InstrumentAutocompleteProps) {
  const [debouncedQuery, setDebouncedQuery] = useState(text);

  // Debounce only the server query, not the visible input — typing should
  // feel immediate. Each keystroke resets a 200ms timer; the query only
  // fires once the timer lapses without interruption.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(text), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [text]);

  const { data: suggestions = [] } = useQuery({
    ...trpc.instruments.search.queryOptions({ query: debouncedQuery }),
    // Keep the prior result while the next one loads — prevents the dropdown
    // from flickering empty between keystrokes.
    placeholderData: (prev) => prev,
  });

  // Suggestions are hidden when the input's text matches the already-picked
  // instrument exactly — once a user confirms a choice they shouldn't see a
  // dropdown for their own selection.
  const selected = suggestions.find((s: Suggestion) => s.id === value);
  const hideSuggestions =
    selected !== undefined && selected.name === text.trim();

  return (
    <View>
      <TextInput
        testID={testID}
        style={styles.input}
        value={text}
        onChangeText={onChangeText}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor="#555"
        editable={!disabled}
        returnKeyType="next"
      />
      {!hideSuggestions && suggestions.length > 0 && (
        <View style={styles.list} testID="instrument-autocomplete-suggestions">
          {suggestions.map((s: Suggestion) => {
            const isSelected = s.id === value;
            return (
              <Pressable
                key={s.id}
                onPress={() => onSelect(s.id, s.name)}
                style={({ pressed }) => [
                  styles.row,
                  isSelected && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Select ${s.name}`}
                testID={`instrument-autocomplete-option-${s.id}`}
                disabled={disabled}
              >
                <Text style={styles.rowText}>{s.name}</Text>
                {s.category && (
                  <Text style={styles.rowCategory}>{s.category}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  list: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 220,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2a2a30",
  },
  rowSelected: { backgroundColor: "#22222a" },
  rowPressed: { opacity: 0.7 },
  rowText: { color: "#fff", fontSize: 15 },
  rowCategory: {
    color: "#7a7a85",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
