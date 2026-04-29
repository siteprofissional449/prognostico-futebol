import type { ReactNode } from 'react';
import { Anchor, List, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { InformacaoSlug } from '../routes/informacaoRoutes';

/**
 * Corpos de texto das páginas /informacao/:slug (exceto mapa-do-site).
 * Revê textos jurídicos com assessoria antes de publicação definitiva.
 */

function QuemSomos() {
  return (
    <Stack gap="lg">
      <Text size="md" c="green.4" fs="italic" fw={600} lh={1.5}>
        &ldquo;De torcedor para torcedor: nossa paixão é o seu palpite certeiro.&rdquo;
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        O <Text span fw={600} c="gray.3">SmartGol</Text> não nasceu de algoritmos frios, mas da
        resenha de domingo, da discussão no grupo de amigos e daquela sensação única que só o
        futebol proporciona. Somos uma equipe de apaixonados que respira o esporte 24 horas por
        dia.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        Mais do que apenas números, nós enxergamos o que acontece dentro das quatro linhas.
        Unimos nossa experiência de anos acompanhando cada rodada com uma análise estratégica
        para entregar prognósticos reais, feitos por quem vive o esporte de verdade, focado
        totalmente em investimento.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        Nosso objetivo é simples: transformar a nossa paixão em uma ferramenta para que você faça
        seu investimento com mais inteligência e confiança. Aqui, o futebol é levado a sério, mas
        a emoção de torcer vem sempre em primeiro lugar.
      </Text>
    </Stack>
  );
}

function TermosECondicoes() {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" lh={1.8}>
        Ao aceder e utilizar o SmartGol, concordas em cumprir estas regras. O serviço destina-se
        a maiores de 18 anos. Os conteúdos (palpites, análises e estatísticas) são informativos e
        de entretenimento; não constituem aconselhamento financeiro nem promessa de resultado.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        É proibido usar a plataforma para fins ilícitos, automação abusiva ou violação de direitos
        de terceiros. Reservamo-nos o direito de suspender contas em caso de fraude ou uso indevido.
        Os planos e preços podem ser alterados com aviso prévio razoável na aplicação.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        Para questões sobre estes termos, contacta-nos pelos canais indicados no site.
      </Text>
    </Stack>
  );
}

function PoliticaPublicidade() {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" lh={1.8}>
        Comunicações comerciais no SmartGol são identificadas de forma clara. Respeitamos boas
        práticas de marketing responsável no setor de apostas e entretenimento desportivo, em linha
        com referências do mercado regulado e entidades como o IBJR e códigos de autorregulação
        aplicáveis à publicidade no Brasil.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        Patrocínios ou parcerias, quando existirem, são assinalados; conteúdos editoriais mantêm
        independência na análise desportiva.
      </Text>
    </Stack>
  );
}

function PrivacidadeCookies() {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" lh={1.8}>
        Tratamos dados pessoais apenas na medida necessária a prestar o serviço (conta, sessão,
        pagamentos quando aplicável) e a cumprir obrigações legais. Utilizamos cookies e tecnologias
        semelhantes para preferências, segurança e estatísticas agregadas.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        Nos termos da LGPD, podes pedir acesso, correção ou eliminação de dados, e revogar
        consentimentos quando aplicável. Detalhes de base legal, prazos e contacto para privacidade
        podem ser complementados aqui quando o encarregado de dados (DPO) estiver definido.
      </Text>
    </Stack>
  );
}

function Editorial() {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" lh={1.8}>
        A linha editorial do SmartGol prioriza análise desportiva honesta e linguagem acessível.
        Procuramos cruzar dados com contexto de calendário, desfalques e momento das equipas — sem
        confundir entretenimento com garantia de lucro.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        Erros factuais podem ser corrigidos quando identificados; críticas e sugestões são bem-vindas
        para melhorar o serviço.
      </Text>
    </Stack>
  );
}

function TrabalheConosco() {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" lh={1.8}>
        Estamos sempre abertos a talentos que partilhem a nossa paixão pelo futebol e por análise
        de dados. Se te identificas com a missão do SmartGol, envia o teu percurso e área de
        interesse (conteúdo, produto, tecnologia) para o e-mail de recrutamento que publicaremos
        aqui ou no rodapé quando o processo estiver formalizado.
      </Text>
      <Text size="sm" c="dimmed" lh={1.8}>
        Igualdade de oportunidades: valorizamos competência e diversidade de experiências.
      </Text>
    </Stack>
  );
}

function JogoResponsavel() {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" lh={1.8}>
        O jogo e as apostas devem ser uma forma de entretenimento, nunca uma solução financeira.
        Definir limites de tempo e de dinheiro, e nunca jogar sob stress ou influência de álcool,
        são atitudes de jogo responsável.
      </Text>
      <List spacing="sm" size="sm" c="dimmed" icon={<ThemeIcon size={20} radius="xl" color="green" variant="light"><IconInfoCircle size={14} /></ThemeIcon>}>
        <List.Item>Proibido para menores de 18 anos.</List.Item>
        <List.Item>Se perceberes que estás a perder o controlo, procura ajuda especializada.</List.Item>
        <List.Item>
          No Brasil, informação e apoio:{' '}
          <Anchor href="https://www.ibjr.org.br/" target="_blank" rel="noopener noreferrer" size="sm" inherit c="green.4">
            IBJR
          </Anchor>
          {' '}— Instituto Brasileiro de Jogo Responsável.
        </List.Item>
        <List.Item>
          Linha de apoio emocional (CVV): 188 — 24h, ligação gratuita.
        </List.Item>
      </List>
    </Stack>
  );
}

const BODIES: Partial<Record<InformacaoSlug, ReactNode>> = {
  'quem-somos': <QuemSomos />,
  'termos-e-condicoes': <TermosECondicoes />,
  'politica-de-publicidade': <PoliticaPublicidade />,
  'privacidade-e-cookies': <PrivacidadeCookies />,
  editorial: <Editorial />,
  'trabalhe-conosco': <TrabalheConosco />,
  'jogo-responsavel': <JogoResponsavel />,
};

export function InformacaoBody({ slug }: { slug: InformacaoSlug }) {
  const body = BODIES[slug];
  if (!body) return null;
  return body;
}
