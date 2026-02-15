export default function TabButton(props: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded border border-gray-300 dark:border-gray-700 text-sm font-medium px-2 py-1 ${props.active ? "bg-gray-100 dark:bg-gray-600" : "hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500"}`}
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
