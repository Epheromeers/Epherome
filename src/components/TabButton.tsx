export default function TabButton(props: {
  children: React.ReactNode;
  active: boolean;
  ariaControls: string;
  id: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-controls={props.ariaControls}
      aria-selected={props.active}
      className={`-mb-px flex items-center border-b-2 px-3 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${
        props.active
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200"
      }`}
      id={props.id}
      onClick={props.onClick}
      role="tab"
      tabIndex={props.active ? 0 : -1}
      type="button"
    >
      {props.children}
    </button>
  );
}
