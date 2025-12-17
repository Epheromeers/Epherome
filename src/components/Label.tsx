export default function Label(props: {
  title: string;
  children: React.ReactNode;
  className?: string;
  helper?: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700">{props.title}</div>
      <div className={props.className}>{props.children}</div>
      {props.helper && (
        <div className="text-xs text-gray-500 pl-3">{props.helper}</div>
      )}
    </div>
  );
}
