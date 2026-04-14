import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// Options for the custom non-text fields. These would normally come from
// an API / config — hardcoded here so the demo stays self-contained.
const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'team', label: 'Team' },
] as const;
type Plan = (typeof PLAN_OPTIONS)[number]['value'];

const GENRE_OPTIONS = [
  { value: 'Jazz', label: 'Jazz' },
  { value: 'Rock', label: 'Rock' },
  { value: 'Classical', label: 'Classical' },
  { value: 'Electronic', label: 'Electronic' },
] as const;
type Genre = (typeof GENRE_OPTIONS)[number]['value'];
// Note: the obvious "wrap in <Pressable onPress={Keyboard.dismiss}>" trick
// breaks scrolling — Pressable intercepts pan gestures before the ScrollView
// can claim them, so you can only scroll from inside a TextInput. Use the
// ScrollView's own keyboard props instead:
//   keyboardShouldPersistTaps="handled" — taps on non-interactive space
//     dismiss the keyboard, taps on buttons still fire.
//   keyboardDismissMode="on-drag" — scrolling dismisses the keyboard, the
//     standard iOS/Android behaviour.

type VanillaState = {
  email: string;
  password: string;
  plan: Plan;
  genre: Genre | null;
};

type RhfValues = {
  displayName: string;
  band: string;
  email: string;
  plan: Plan;
  genre: Genre | null;
};

export default function FormsScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      // iOS: keyboard overlaps content, padding adds space at the bottom.
      // Android: system `adjustResize` usually already resizes the window,
      // so no behavior is often best — setting 'height' here can fight it.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Forms & keyboard</Text>
        <Text style={styles.intro}>
          Two forms. Same fields. First is vanilla controlled state; second
          is react-hook-form. Tap whitespace or drag-scroll to dismiss the
          keyboard.
        </Text>

        <VanillaForm />
        <RhfForm />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --------------------------------------------------------------------------
// Vanilla: controlled TextInput + focus chain via refs.
// --------------------------------------------------------------------------

function VanillaForm() {
  const [values, setValues] = useState<VanillaState>({
    email: '',
    password: '',
    plan: 'free',
    genre: null,
  });
  const [submitted, setSubmitted] = useState<VanillaState | null>(null);

  // Refs let us programmatically move focus on "next" keypress.
  // TextInput's submitEditing fires when the user hits return/next.
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = () => {
    setSubmitted(values);
    Keyboard.dismiss();
  };

  const emailInvalid = values.email.length > 0 && !values.email.includes('@');

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Vanilla controlled form</Text>

      <Field label="Email">
        <TextInput
          style={[styles.input, emailInvalid && styles.inputError]}
          value={values.email}
          onChangeText={(email) => setValues((v) => ({ ...v, email }))}
          placeholder="you@example.com"
          placeholderTextColor="#4a4a52"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />
        {emailInvalid && <Text style={styles.errorText}>Missing @</Text>}
      </Field>

      <Field label="Password">
        <TextInput
          ref={passwordRef}
          style={styles.input}
          value={values.password}
          onChangeText={(password) => setValues((v) => ({ ...v, password }))}
          placeholder="••••••••"
          placeholderTextColor="#4a4a52"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
      </Field>

      <Field label="Plan">
        <RadioGroup
          value={values.plan}
          onChange={(plan) => setValues((v) => ({ ...v, plan }))}
          options={PLAN_OPTIONS}
        />
      </Field>

      <Field label="Favourite genre">
        <Select
          value={values.genre}
          onChange={(genre) => setValues((v) => ({ ...v, genre }))}
          options={GENRE_OPTIONS}
          placeholder="Pick one…"
        />
      </Field>

      <Pressable style={styles.submit} onPress={onSubmit}>
        <Text style={styles.submitText}>Submit</Text>
      </Pressable>

      {submitted && (
        <Text style={styles.result}>
          Submitted · {submitted.email} · {submitted.plan} ·{' '}
          {submitted.genre ?? '(no genre)'}
        </Text>
      )}

      <Text style={styles.note}>
        Every keystroke triggers a parent re-render (VanillaForm re-runs). For
        two fields it's fine; for ten with heavy siblings you'd feel it.
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// react-hook-form: field state lives in refs outside the React tree.
// Parent does NOT re-render on every keystroke — Controller isolates each
// field's state. This is the actual reason people pick rhf on RN.
// --------------------------------------------------------------------------

function RhfForm() {
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitSuccessful },
    reset,
  } = useForm<RhfValues>({
    defaultValues: {
      displayName: '',
      band: '',
      email: '',
      plan: 'free',
      genre: null,
    },
    mode: 'onBlur',
  });

  const bandRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const onSubmit = (values: RhfValues) => {
    Keyboard.dismiss();
    reset(values); // keep the values but clear dirty state
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>react-hook-form version</Text>

      <Controller
        control={control}
        name="displayName"
        rules={{ required: 'Required', minLength: { value: 2, message: 'Too short' } }}
        render={({ field: { value, onChange, onBlur } }) => (
          <Field label="Display name" error={errors.displayName?.message}>
            <TextInput
              style={[styles.input, errors.displayName && styles.inputError]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Jimi"
              placeholderTextColor="#4a4a52"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => bandRef.current?.focus()}
              blurOnSubmit={false}
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="band"
        rules={{ required: 'Required' }}
        render={({ field: { value, onChange, onBlur } }) => (
          <Field label="Band" error={errors.band?.message}>
            <TextInput
              ref={bandRef}
              style={[styles.input, errors.band && styles.inputError]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="The Experience"
              placeholderTextColor="#4a4a52"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="email"
        rules={{
          required: 'Required',
          pattern: { value: /@/, message: 'Missing @' },
        }}
        render={({ field: { value, onChange, onBlur } }) => (
          <Field label="Email" error={errors.email?.message}>
            <TextInput
              ref={emailRef}
              style={[styles.input, errors.email && styles.inputError]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="jimi@experience.band"
              placeholderTextColor="#4a4a52"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          </Field>
        )}
      />

      {/*
        Non-text fields. Note how the Controller pattern is IDENTICAL to the
        TextInput ones above — same render prop, same value/onChange/onBlur.
        RadioGroup and Select are just controlled components that happen not
        to be a TextInput. This is the universal RHF pattern on RN.
      */}
      <Controller
        control={control}
        name="plan"
        render={({ field: { value, onChange } }) => (
          <Field label="Plan">
            <RadioGroup value={value} onChange={onChange} options={PLAN_OPTIONS} />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="genre"
        rules={{ required: 'Pick a genre' }}
        render={({ field: { value, onChange } }) => (
          <Field label="Favourite genre" error={errors.genre?.message}>
            <Select
              value={value}
              onChange={onChange}
              options={GENRE_OPTIONS}
              placeholder="Pick one…"
              hasError={errors.genre != null}
            />
          </Field>
        )}
      />

      <Pressable
        style={[styles.submit, !isDirty && styles.submitDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={!isDirty}
      >
        <Text style={styles.submitText}>Submit</Text>
      </Pressable>

      {isSubmitSuccessful && (
        <Text style={styles.result}>Submitted — form reset to submitted values</Text>
      )}

      <Text style={styles.note}>
        RHF stores field state in refs, not React state. Each Controller owns
        its own isolated re-render; the parent doesn't re-run on keystrokes.
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// RadioGroup — inline pill row. Controlled via value + onChange, no internal
// state. Generic over the value type so the caller gets a typed onChange.
// --------------------------------------------------------------------------

function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <View style={styles.radioRow}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[styles.radioPill, selected && styles.radioPillActive]}
          >
            <Text
              style={[styles.radioText, selected && styles.radioTextActive]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --------------------------------------------------------------------------
// Select — Pressable trigger + Modal with a list. RN has no native <select>;
// this is the standard hand-rolled pattern. For production you'd reach for
// @react-native-picker/picker (native wheel/dropdown) or a bottom-sheet lib.
// --------------------------------------------------------------------------

function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  hasError,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  placeholder: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={[styles.select, hasError && styles.inputError]}
      >
        <Text
          style={[styles.selectText, !selected && styles.selectPlaceholder]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/*
          Backdrop Pressable closes the modal on tap. RN's touch responder
          system means the inner Pressables win their own taps without the
          backdrop firing — no stopPropagation needed.
        */}
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Pick one</Text>
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.modalItem,
                    isSelected && styles.modalItemActive,
                  ]}
                >
                  <Text style={styles.modalItemText}>{opt.label}</Text>
                  {isSelected && <Text style={styles.modalItemCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// --------------------------------------------------------------------------
// Presentational
// --------------------------------------------------------------------------

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0f0f11' },
  content: { padding: 16, paddingBottom: 64 },
  title: { color: '#6c63ff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  intro: { color: '#8a8a92', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  card: {
    backgroundColor: '#14141a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#23232b',
  },
  sectionTitle: {
    color: '#e4e4e7',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    color: '#6a6a72',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f0f11',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a32',
    color: '#e4e4e7',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputError: { borderColor: '#9a2a2a' },
  errorText: { color: '#d47878', fontSize: 11, marginTop: 4 },
  submit: {
    backgroundColor: '#6c63ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitDisabled: { backgroundColor: '#2a2a32' },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  result: {
    color: '#8dd48d',
    fontSize: 12,
    marginTop: 10,
  },
  note: {
    color: '#6a6a72',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    fontStyle: 'italic',
  },
  radioRow: { flexDirection: 'row', gap: 8 },
  radioPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a32',
    backgroundColor: '#0f0f11',
    alignItems: 'center',
  },
  radioPillActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  radioText: { color: '#8a8a92', fontSize: 13, fontWeight: '600' },
  radioTextActive: { color: '#fff' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f11',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a32',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectText: { color: '#e4e4e7', fontSize: 14 },
  selectPlaceholder: { color: '#4a4a52' },
  selectChevron: { color: '#6a6a72', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    backgroundColor: '#1a1a1f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a32',
    padding: 12,
  },
  modalTitle: {
    color: '#6a6a72',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalItemActive: { backgroundColor: '#2a2a32' },
  modalItemText: { color: '#e4e4e7', fontSize: 15 },
  modalItemCheck: { color: '#6c63ff', fontSize: 16, fontWeight: '700' },
});
