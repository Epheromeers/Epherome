export default function ListItem(props: {
  checked?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex space-x-1 items-center py-1 px-3 text-sm font-medium w-full rounded text-left ${props.checked ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
