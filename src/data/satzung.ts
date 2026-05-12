// Satzungsversionen — neueste zuerst.
// Um eine neue Version zu veröffentlichen:
//   1. Aktuelle Version in diesem Array lassen (wird automatisch Archiv)
//   2. Neue Version als erstes Element einfügen

export type Item = string | { text: string; sub: string[] };

export interface SatzungSection {
  heading: string;
  intro?: string;
  items: Item[];
}

export interface SatzungVersion {
  id: string;       // YYYY-MM-DD, eindeutig
  date: string;     // Anzeigedatum "12. Mai 2026"
  label: string;    // z.B. "Gründungssatzung" oder "Änderung §5"
  sections: SatzungSection[];
}

export const versions: SatzungVersion[] = [
  {
    id: '2026-05-12',
    date: '12. Mai 2026',
    label: 'Gründungssatzung',
    sections: [
      {
        heading: '§ 1 Name, Sitz, Geschäftsjahr',
        items: [
          'Der Verein führt den Namen <em>Dumb Decision TTRPG</em>. Nach Eintragung ins Vereinsregister trägt er den Zusatz „e.&nbsp;V.".',
          'Der Verein hat seinen Sitz in Hamburg.',
          'Das Geschäftsjahr ist das Kalenderjahr.',
        ],
      },
      {
        heading: '§ 2 Zweck des Vereins',
        items: [
          'Zweck des Vereins ist die <strong>Förderung der Jugendhilfe, Bildung, Kunst und Kultur</strong> durch das gemeinschaftliche Spielen und Erleben von <strong>Pen-&amp;-Paper-Rollenspielen</strong>, insbesondere Dungeons &amp; Dragons.',
          'Der Verein richtet sich insbesondere an <strong>Jugendliche und junge Erwachsene im Alter von etwa 14 bis 25 Jahren</strong>, bietet jedoch eine offene und inklusive Gemeinschaft für alle Interessierten.',
          'Der Verein verfolgt ausschließlich und unmittelbar <strong>gemeinnützige Zwecke</strong> im Sinne des Abschnitts „Steuerbegünstigte Zwecke" der Abgabenordnung (§§ 51 ff. AO).',
          {
            text: 'Der Satzungszweck wird insbesondere verwirklicht durch:',
            sub: [
              'regelmäßige Spielrunden und Workshops,',
              'öffentliche Veranstaltungen, Einsteigerhilfen, Kreativtreffen,',
              'Förderung sozialer und kreativer Kompetenzen,',
              'Bereitstellung von Spielmaterialien und Räumlichkeiten,',
              'Kooperationen mit Schulen, Jugendzentren und sozialen Einrichtungen.',
            ],
          },
        ],
      },
      {
        heading: '§ 3 Selbstlosigkeit',
        items: [
          'Der Verein ist <strong>selbstlos tätig</strong> und verfolgt <strong>nicht in erster Linie eigenwirtschaftliche Zwecke</strong>.',
          'Mittel des Vereins dürfen nur für satzungsgemäße Zwecke verwendet werden.',
          'Die Mitglieder erhalten in ihrer Eigenschaft als Mitglieder keine Zuwendungen aus Mitteln des Vereins.',
        ],
      },
      {
        heading: '§ 4 Mitgliedschaft',
        items: [
          'Mitglied kann jede natürliche Person ab 14 Jahren werden, die die Ziele des Vereins unterstützt.',
          'Über den schriftlichen Aufnahmeantrag entscheidet der Vorstand.',
          'Minderjährige benötigen die Einwilligung ihrer gesetzlichen Vertretung.',
          'Die Mitgliedschaft endet durch Austritt, Ausschluss oder Tod.',
          'Der Austritt ist jederzeit zum Ende des laufenden Monats durch formlose E-Mail an <strong>vorstand@dumbdecision.de</strong> möglich.',
        ],
      },
      {
        heading: '§ 5 Beiträge',
        items: [
          'Der Verein behält sich vor, Mitgliedsbeiträge zu erheben. Über Einführung und Höhe entscheidet die Mitgliederversammlung; die Mitglieder werden rechtzeitig informiert.',
          'Werden Mitgliedsbeiträge neu eingeführt oder erhöht, steht jedem Mitglied ein <strong>Sonderkündigungsrecht</strong> zu: Die Kündigung ist bis zum Ende des übernächsten Monats nach Bekanntgabe möglich und wirkt zum selben Termin.',
          'In begründeten Fällen kann der Vorstand Beiträge ganz oder teilweise erlassen.',
        ],
      },
      {
        heading: '§ 6 Organe des Vereins',
        intro: 'Die Organe des Vereins sind:',
        items: [
          'die <strong>Mitgliederversammlung</strong>',
          'der <strong>Vorstand</strong>',
        ],
      },
      {
        heading: '§ 7 Vorstand',
        items: [
          {
            text: 'Der Vorstand besteht aus mindestens drei Personen:',
            sub: [
              'dem/der 1. Vorsitzenden',
              'dem/der stellvertretenden Vorsitzenden',
              'dem/der Kassenwart:in',
            ],
          },
          'Der Vorstand wird von der Mitgliederversammlung für die Dauer von zwei Jahren gewählt. Wiederwahl ist möglich.',
          'Der Verein wird gerichtlich und außergerichtlich durch zwei Vorstandsmitglieder vertreten (§ 26 BGB).',
          'Der Vorstand führt die Geschäfte des Vereins ehrenamtlich.',
        ],
      },
      {
        heading: '§ 8 Mitgliederversammlung',
        items: [
          'Die Mitgliederversammlung ist das höchste Organ des Vereins.',
          'Sie findet mindestens einmal im Jahr statt. Sie wird vom Vorstand schriftlich mit einer Frist von zwei Wochen unter Angabe der Tagesordnung einberufen.',
          {
            text: 'Aufgaben:',
            sub: [
              'Wahl und Abberufung des Vorstands',
              'Entgegennahme des Jahresberichts',
              'Entlastung des Vorstands',
              'Festlegung der Mitgliedsbeiträge',
              'Satzungsänderungen und Auflösung des Vereins',
            ],
          },
          'Beschlüsse werden mit einfacher Mehrheit gefasst. Satzungsänderungen erfordern eine 2/3-Mehrheit.',
        ],
      },
      {
        heading: '§ 9 Auflösung des Vereins',
        items: [
          'Bei Auflösung des Vereins oder Wegfall steuerbegünstigter Zwecke fällt das Vermögen des Vereins an eine juristische Person des öffentlichen Rechts oder eine andere steuerbegünstigte Körperschaft, die es <strong>unmittelbar und ausschließlich für gemeinnützige Zwecke der Jugendhilfe oder Bildung</strong> zu verwenden hat.',
          'Über die konkrete Organisation entscheidet die Mitgliederversammlung bei Auflösung.',
        ],
      },
      {
        heading: '§ 10 Datenschutz',
        items: [
          'Der Verein erhebt und speichert personenbezogene Daten seiner Mitglieder ausschließlich zur Erfüllung der Vereinszwecke und -pflichten.',
          'Eine Weitergabe an Dritte erfolgt nur, wenn dies zur Erfüllung des Vereinszwecks notwendig ist.',
        ],
      },
    ],
  },
];
