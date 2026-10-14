export default function ScenicPhoto({
  className = "",
  eager = false,
  alt = "A winding road through the forest in Rocky Mountain National Park",
}: {
  className?: string;
  eager?: boolean;
  alt?: string;
}) {
  return (
    <img
      className={className}
      src="/images/scenic-road-1600.webp"
      srcSet="/images/scenic-road-800.webp 800w, /images/scenic-road-1600.webp 1600w"
      sizes="(max-width: 760px) 100vw, 1100px"
      width="1600"
      height="2400"
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
