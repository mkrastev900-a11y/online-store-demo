import type {
  AdminHelpControl,
  AdminHelpControlKind,
  AdminHelpError,
  AdminHelpSection,
  AdminHelpStatus,
  AdminHelpWorkflow,
} from "./types";

function slug(value: string) {
  return value
    .toLocaleLowerCase("bg-BG")
    .normalize("NFKD")
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

type ControlInput = Omit<AdminHelpControl, "id" | "kind" | "errors" | "avoid"> & {
  id?: string;
  kind?: AdminHelpControlKind;
  errors?: string[];
  avoid?: string[];
};

export function control(input: ControlInput): AdminHelpControl {
  return {
    id: input.id ?? slug(input.name),
    kind: input.kind ?? "field",
    errors: input.errors ?? [
      "Ако системата покаже червено съобщение, прочети го докрай и провери стойността, преди да опиташ отново.",
      "Ако действието е забранено, вероятно акаунтът ти няма нужното право. Не търси заобиколен начин.",
    ],
    avoid: input.avoid ?? [
      "Не въвеждай примерни или измислени данни в реалния магазин.",
      "Не повтаряй действието, докато първото натискане още се обработва.",
    ],
    ...input,
  };
}

export function field(
  name: string,
  purpose: string,
  format: string,
  example: string,
  after: string,
  options: Partial<ControlInput> = {},
) {
  return control({
    name,
    kind: "field",
    purpose,
    when: "Попълни полето, когато създаваш или променяш този запис.",
    how: [
      "Натисни веднъж в полето.",
      "Въведи стойността в посочения формат.",
      "Прегледай написаното за правописни грешки и излишни интервали.",
    ],
    format,
    example,
    after,
    customerImpact: "Ако стойността е публична, клиентът ще я вижда след успешен запис или публикуване. Ако е вътрешна, тя остава само в Admin.",
    success: "След запис стойността остава видима при повторно отваряне на страницата.",
    ...options,
  });
}

export function selectControl(
  name: string,
  purpose: string,
  example: string,
  after: string,
  options: Partial<ControlInput> = {},
) {
  return control({
    name,
    kind: "select",
    purpose,
    when: "Използвай списъка, когато трябва да избереш една от разрешените от системата стойности.",
    how: [
      "Натисни стрелката на падащото меню.",
      "Прочети всички подходящи възможности.",
      "Избери точно една стойност и провери дали тя остава показана в полето.",
    ],
    format: "Избира се готова стойност; не се въвежда свободен текст.",
    example,
    after,
    customerImpact: "Изборът може да промени групирането, статуса или публичното показване според конкретното поле.",
    success: "Избраната стойност остава видима и след запис или презареждане.",
    ...options,
  });
}

export function toggleControl(
  name: string,
  purpose: string,
  after: string,
  options: Partial<ControlInput> = {},
) {
  return control({
    name,
    kind: "checkbox",
    purpose,
    when: "Промени отметката само когато разбираш какво включва или изключва.",
    how: [
      "Провери текущото състояние: отметнато означава включено.",
      "Натисни веднъж, ако трябва да смениш състоянието.",
      "Запиши формата и провери резултата.",
    ],
    format: "Включено или изключено.",
    example: "Отметнато = включено; празно = изключено.",
    after,
    customerImpact: "Когато настройката управлява видимост, клиентът ще види промяната след запис или публикуване.",
    success: "След повторно отваряне отметката е в избраното състояние.",
    ...options,
  });
}

export function button(
  name: string,
  purpose: string,
  after: string,
  options: Partial<ControlInput> = {},
) {
  return control({
    name: `Бутон „${name}“`,
    id: options.id ?? slug(name),
    kind: "button",
    purpose,
    when: "Използвай бутона само след като провериш, че работиш с правилния запис и данните са готови.",
    how: [
      "Провери всички свързани полета и предупреждения.",
      "Натисни бутона веднъж.",
      "Изчакай съобщение, обновяване на екрана или край на състоянието „Обработване“.",
    ],
    after,
    customerImpact: "В зависимост от действието промяната може да стане видима за клиента или да промени поръчка, наличност, комуникация или публикуван дизайн.",
    success: "Появява се потвърждение, записът се обновява или страницата показва новото състояние.",
    ...options,
  });
}

export function workflow(
  id: string,
  title: string,
  goal: string,
  steps: string[],
  result: string,
  options: Partial<AdminHelpWorkflow> = {},
): AdminHelpWorkflow {
  return { id, title, goal, steps, result, ...options };
}

type TopicInput = Omit<
  AdminHelpSection,
  "statuses" | "workflows" | "errors" | "mistakes" | "checklist" | "tips"
> & {
  statuses?: AdminHelpStatus[];
  workflows?: AdminHelpWorkflow[];
  errors?: AdminHelpError[];
  mistakes?: string[];
  checklist?: string[];
  tips?: string[];
};

export function topic(input: TopicInput): AdminHelpSection {
  return {
    statuses: [],
    workflows: [],
    errors: [],
    mistakes: [],
    checklist: [],
    tips: [],
    ...input,
  };
}
