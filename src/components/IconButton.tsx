export default function IconButton(props: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`flex items-center rounded p-2 ${props.active ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"}`}
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
