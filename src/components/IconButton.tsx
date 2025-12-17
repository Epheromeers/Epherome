export default function IconButton(props: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      className="block rounded p-2 hover:bg-gray-100 active:bg-gray-200"
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
