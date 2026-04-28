export function SearchBox({ action, placeholder, defaultValue }: { action: string; placeholder: string; defaultValue?: string }) {
  return (
    <form className="search-box" action={action}>
      <label className="sr-only" htmlFor="site-search">
        Search news
      </label>
      <input id="site-search" name="q" type="search" placeholder={placeholder} defaultValue={defaultValue} />
      <button type="submit">Search</button>
    </form>
  );
}
