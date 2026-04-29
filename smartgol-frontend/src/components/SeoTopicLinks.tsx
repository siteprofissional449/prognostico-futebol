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
      <Group gap="xs" wrap="wrap">
        <Anchor component={Link} to="/prognosticos" size="sm" c="dimmed">
          Prognósticos e palpites de hoje
        </Anchor>
        <Text span size="sm" c="dimmed">
          ·
        </Text>
        <Anchor component={Link} to="/planos" size="sm" c="dimmed">
          Planos SmartGol
        </Anchor>
        {home && (
          <>
            <Text span size="sm" c="dimmed">
              ·
            </Text>
            <Anchor component={Link} to={`/equipa/${slugifyTeam(home)}`} size="sm" c="dimmed">
              Página {home} (equipa)
            </Anchor>
          </>
        )}
        {away && (
          <>
            <Text span size="sm" c="dimmed">
              ·
            </Text>
            <Anchor component={Link} to={`/equipa/${slugifyTeam(away)}`} size="sm" c="dimmed">
              Página {away} (equipa)
            </Anchor>
          </>
        )}
        {lg && (
          <>
            <Text span size="sm" c="dimmed">
              ·
            </Text>
            <Anchor component={Link} to={`/liga/${leagueSlug(lg)}`} size="sm" c="dimmed">
              Competição {lg}
            </Anchor>
          </>
        )}
        <Text span size="sm" c="dimmed">
          ·
        </Text>
        <Anchor component={Link} to="/informacao/jogo-responsavel" size="sm" c="dimmed">
          Jogo responsável
        </Anchor>
      </Group>
    </section>
  );
}
