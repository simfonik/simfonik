import { Playground } from '../_components/Playground';
import { PlaceholdersMock } from './_placeholders-mock';

export const metadata = {
  title: 'placeholders — /dev',
};

export default function PlaceholdersPage() {
  return (
    <Playground>
      <PlaceholdersMock />
    </Playground>
  );
}
