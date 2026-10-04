import { Icon, type IconName } from './Icon';

export function DocumentIcon({ name, size = 18 }: { name: string; size?: number }) {
  const icon: IconName = /\.(png|jpe?g|webp|gif|svg)$/i.test(name) ? 'image' : /\.(csv|tsv)$/i.test(name) ? 'table' : 'file';
  return <Icon name={icon} width={size} height={size} />;
}
