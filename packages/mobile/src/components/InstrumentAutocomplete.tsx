import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpc } from "../trpc";

// MUS-68: instrument picker. Originally an inline dropdown below the input
// in the Post Request form, but the iOS keyboard was pushing the suggestion
// list below the viewport on small devices — users couldn't see or tap
// suggestions. Reworked as a field-that-opens-a-full-screen-modal so the
// search UI owns its own viewport and the keyboard can't shove it offscreen.
// This also scales better as the instrument taxonomy grows (150+ rows
// today; more planned).
//
// Public prop contract is unchanged — the Post Request call sites still
// pass `value`, `text`, `onChangeText`, `onSelect`, `disabled`, `placeholder`,
// `testID` and the form state machinery behaves identically.
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
  /** The display text shown in the field. Usually the instrument's `name`
   *  for a committed selection, or empty before the user picks anything. */
  text: string;
  /** Retained for API compatibility with the pre-modal dropdown version.
   *  The modal owns its own search input, so the outer field no longer
   *  emits per-keystroke changes — this callback only fires on selection
   *  (from `onSelect` the parent typically calls `onChangeText(name)` to
   *  mirror the picked name into its `text` state). */
  onChangeText: (text: string) => void;
  /** Called when the user taps a row in the modal. Passes id + name so the
   *  form can remember both and surface the name back in the field. */
  onSelect: (id: number, name: string) => void;
  /** Disables the field entirely while the parent is submitting. */
  disabled?: boolean;
  placeholder?: string;
  testID?: string;
}

export function InstrumentAutocomplete({
  value: _value,
  text,
  onChangeText: _onChangeText,
  onSelect,
  disabled,
  placeholder = "e.g. Bass Guitar",
  testID,
}: InstrumentAutocompleteProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const openModal = () => {
    if (disabled) return;
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleSelect = (id: number, name: string) => {
    onSelect(id, name);
    setModalVisible(false);
  };

  return (
    <>
      <Pressable
        testID={testID}
        onPress={openModal}
        disabled={disabled}
        style={[
          styles.field,
          disabled && styles.fieldDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={text.length > 0 ? text : "Select instrument"}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text
          style={[styles.fieldText, text.length === 0 && styles.fieldPlaceholder]}
          numberOfLines={1}
        >
          {text.length > 0 ? text : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#7a7a85" />
      </Pressable>

      <InstrumentPickerModal
        visible={modalVisible}
        onCancel={closeModal}
        onSelect={handleSelect}
      />
    </>
  );
}

// --- Modal ------------------------------------------------------------------

interface InstrumentPickerModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (id: number, name: string) => void;
}

function InstrumentPickerModal({
  visible,
  onCancel,
  onSelect,
}: InstrumentPickerModalProps) {
  // Local to the modal — parent doesn't care about the in-progress search
  // string, only the final selection.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<TextInput | null>(null);

  // Reset the search field each time the modal opens and auto-focus the
  // input so the user can start typing immediately. Without this the field
  // would remember the previous search across openings, which is a mildly
  // weird UX — a fresh list view is the expected default.
  useEffect(() => {
    if (visible) {
      setQuery("");
      setDebouncedQuery("");
      // Tiny delay lets the slide-in animation settle before focus; focusing
      // on the same tick the modal mounts sometimes no-ops on iOS.
      const h = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(h);
    }
  }, [visible]);

  // Debounce only the server query, not the visible input — typing should
  // feel immediate. Each keystroke resets a 200ms timer; the query only
  // fires once the timer lapses without interruption.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [query]);

  // Android hardware back should close the modal the same way tapping
  // Cancel does. The RN Modal's onRequestClose also wires this up, but
  // adding a listener ensures consistency if the Modal is ever replaced.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);

  const trimmed = debouncedQuery.trim();
  const hasQuery = trimmed.length > 0;

  // Don't fire `instruments.search` with an empty query — the server would
  // happily return the whole taxonomy (150+ rows) which is (a) pointless
  // UX before any input, and (b) user-requested: "don't show all
  // suggestions before the user types".
  const { data: suggestions = [] } = useQuery({
    ...trpc.instruments.search.queryOptions({ query: trimmed }),
    enabled: hasQuery,
    // Keep the prior result while the next one loads — prevents the list
    // from flickering empty between keystrokes.
    placeholderData: (prev) => prev,
  });

  const renderEmpty = () => {
    if (!hasQuery) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Start typing to search instruments
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No instruments match that search.</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
      testID="instrument-picker-modal"
    >
      <SafeAreaView style={styles.modalRoot} edges={["top", "bottom"]}>
        <View style={styles.modalHeader}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="instrument-picker-cancel"
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && styles.cancelBtnPressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Select instrument</Text>
          {/* Invisible spacer keeps the title visually centred opposite
              the Cancel button without depending on absolute positioning. */}
          <View style={styles.headerSpacer} />
        </View>

        <TextInput
          ref={inputRef}
          testID="instrument-picker-search"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search instruments"
          placeholderTextColor="#555"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          contextMenuHidden
        />

        <FlatList
          testID="instrument-picker-list"
          data={hasQuery ? (suggestions as Suggestion[]) : []}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.id, item.name)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Select ${item.name}`}
              testID={`instrument-picker-option-${item.id}`}
            >
              <Text style={styles.rowText}>{item.name}</Text>
              {item.category && (
                <Text style={styles.rowCategory}>{item.category}</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Outer field — styled to look like a form input so it blends with the
  // surrounding Post Request layout.
  field: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { color: "#fff", fontSize: 16, flexShrink: 1 },
  fieldPlaceholder: { color: "#555" },

  // Modal shell.
  modalRoot: { flex: 1, backgroundColor: "#0f0f11" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 64,
  },
  cancelBtnPressed: { opacity: 0.6 },
  cancelText: { color: "#6c63ff", fontSize: 16 },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  headerSpacer: { minWidth: 64 },

  // Search input inside the modal. Matches the Post Request form input
  // styling so the visual language is consistent.
  searchInput: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },

  // List + rows.
  listContent: { paddingTop: 8, paddingBottom: 24 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a30",
  },
  rowPressed: { opacity: 0.7, backgroundColor: "#1a1a1f" },
  rowText: { color: "#fff", fontSize: 15, flexShrink: 1 },
  rowCategory: {
    color: "#7a7a85",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 12,
  },

  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: { color: "#7a7a85", fontSize: 14, textAlign: "center" },
});
