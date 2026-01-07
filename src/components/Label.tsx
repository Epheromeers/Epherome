export default function Label(props: {
  title: string;
  children: React.ReactNode;
  className?: string;
  helper?: string;
  accentHelper?: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 dark:text-gray-400">
        {props.title}
      </div>
      <div className={props.className}>{props.children}</div>
      {props.helper && (
        <div className="text-xs text-gray-500 dark:text-gray-200">
          {props.helper}
        </div>
      )}
      {props.accentHelper && (
        <div className="text-xs font-medium dark:text-gray-200">
          {props.accentHelper}
        </div>
      )}
    </div>
  );
}
