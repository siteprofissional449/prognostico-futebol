import { Link } from 'react-router-dom';
import { Group, Anchor, Text } from '@mantine/core';
import { slugifyTeam } from '../utils/matchSlug';

type Props = {
  homeTeam?: string;
  awayTeam?: string;
  leagueName?: string | null;
};

function leagueSlug(name: string) {
  return slugifyTeam(name);
}

export function SeoTopicLinks({ homeTeam, awayTeam, leagueName }: Props) {
  const home = homeTeam?.trim();
  const away = awayTeam?.trim();
  const lg = leagueName?.trim();

  return (
    <section aria-label="Ligações úteis">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
        Ver também
      </Text>
      <Group gap={6} wrap="wrap">
        <Anchor component={Link} to="/prognosticos" size="xs" c="dimmed">
          Palpites hoje
        </Anchor>
        <Text span size="sm" c="dimmed">
          ·
        </Text>
        <Anchor component={Link} to="/planos" size="xs" c="dimmed">
          Planos
        </Anchor>
        {home && (
          <>
            <Text span size="sm" c="dimmed">
              ·
            </Text>
            <Anchor component={Link} to={`/equipa/${slugifyTeam(home)}`} size="xs" c="dimmed">
              Equipa casa
            </Anchor>
          </>
        )}
        {away && (
          <>
            <Text span size="sm" c="dimmed">
              ·
            </Text>
            <Anchor component={Link} to={`/equipa/${slugifyTeam(away)}`} size="xs" c="dimmed">
              Equipa fora
            </Anchor>
          </>
        )}
        {lg && (
          <>
            <Text span size="sm" c="dimmed">
              ·
            </Text>
            <Anchor component={Link} to={`/liga/${leagueSlug(lg)}`} size="xs" c="dimmed">
              {lg}
            </Anchor>
          </>
        )}
        <Text span size="sm" c="dimmed">
          ·
        </Text>
        <Anchor component={Link} to="/informacao/jogo-responsavel" size="xs" c="dimmed">
          Jogo responsável
        </Anchor>
      </Group>
    </section>
  );
}
