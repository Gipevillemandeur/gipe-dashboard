import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOfficePermission } from '@/lib/office-auth';

/*
 * =========================================================
 * ADHÉRENTS
 * =========================================================
 *
 * GET                → adhérents + classes de l'année en cours
 * GET ?previous=nom  → familles des années précédentes
 *                      (pour le renouvellement)
 * POST / PUT         → enregistrement via la fonction SQL
 *                      gipe_save_membership :
 *                      - tout ou rien ;
 *                      - anti-doublon, même en simultané ;
 *                      - recette « Adhésions » en trésorerie.
 */

type Admin = ReturnType<typeof createAdminClient>;

async function requireMembersAccess(): Promise<Admin | NextResponse> {
  try {
    await requireOfficePermission('members');
    return createAdminClient();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'AUTHENTICATION_REQUIRED') {
        return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
      }

      if (
        error.message === 'OFFICE_ACCESS_DENIED' ||
        error.message === 'OFFICE_PERMISSION_DENIED'
      ) {
        return NextResponse.json({ error: 'Compte non autorisé.' }, { status: 403 });
      }
    }

    console.error('Erreur contrôle accès membres:', error);

    return NextResponse.json(
      { error: 'Erreur de contrôle des accès.' },
      { status: 500 }
    );
  }
}

const COUNCIL_VALUES = ['no', 'child_class', 'all_classes'];
const PAYMENT_METHODS = ['cheque', 'cash', 'transfer', 'online', 'other'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function sortFr(a: string, b: string) {
  return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
}

async function activeYear(admin: Admin) {
  const { data, error } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/* ---------------------------------------------------------
 * GET
 * --------------------------------------------------------- */

export async function GET(request: Request) {
  const auth = await requireMembersAccess();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  try {
    const year = await activeYear(admin);
    const previous = new URL(request.url).searchParams.get('previous');

    if (previous !== null) {
      return NextResponse.json({
        families: await searchPreviousFamilies(admin, previous, year?.id || null),
      });
    }

    if (!year) {
      return NextResponse.json({
        schoolYear: null,
        total: 0,
        byClass: [],
        members: [],
        classes: [],
      });
    }

    const [membershipsResult, classesResult] = await Promise.all([
      admin
        .from('gipe_memberships')
        .select(`
          id,
          adherent_id,
          renewal,
          council_participation,
          board_member,
          ca_member,
          payment_received,
          payment_date,
          payment_method,
          cheque_number,
          amount,
          created_at,
          gipe_adherents ( id, last_name, first_name, address, phone, email ),
          gipe_membership_children (
            id,
            gipe_children ( id, last_name, first_name ),
            classes ( id, name )
          )
        `)
        .eq('school_year_id', year.id)
        .order('created_at', { ascending: false }),

      // Classes chargées ici (et non via Configuration) :
      // un poste « Adhérents » sans « Configuration » doit
      // pouvoir travailler.
      admin
        .from('classes')
        .select('id,name')
        .eq('school_year_id', year.id)
        .eq('active', true),
    ]);

    if (membershipsResult.error) throw new Error(membershipsResult.error.message);
    if (classesResult.error) throw new Error(classesResult.error.message);

    const members = (membershipsResult.data || []).map((m: any) => {
      const adherent = one<any>(m.gipe_adherents) || {};

      return {
        id: m.id,
        adherentId: m.adherent_id,
        lastName: adherent.last_name || '',
        firstName: adherent.first_name || '',
        address: adherent.address || '',
        phone: adherent.phone || '',
        email: adherent.email || '',
        renewal: m.renewal,
        councilParticipation: m.council_participation,
        boardMember: m.board_member,
        caMember: m.ca_member,
        paymentReceived: m.payment_received,
        paymentDate: m.payment_date,
        paymentMethod: m.payment_method,
        chequeNumber: m.cheque_number,
        amount: m.amount,
        createdAt: m.created_at,
        children: (m.gipe_membership_children || []).map((link: any) => {
          const child = one<any>(link.gipe_children) || {};
          const cls = one<any>(link.classes) || {};

          return {
            id: child.id,
            lastName: child.last_name || '',
            firstName: child.first_name || '',
            classId: cls.id || '',
            className: cls.name || '',
          };
        }),
      };
    });

    /*
     * Répartition par classe : un ADHÉRENT compte une fois
     * dans chaque classe où il a au moins un enfant
     * (même règle que le bilan annuel).
     */
    const byClassSets = new Map<string, Set<string>>();

    for (const member of members) {
      for (const child of member.children) {
        if (!child.className) continue;
        if (!byClassSets.has(child.className)) byClassSets.set(child.className, new Set());
        byClassSets.get(child.className)!.add(member.id);
      }
    }

    const byClass = [...byClassSets.entries()]
      .map(([className, ids]) => ({ className, count: ids.size }))
      .sort((a, b) => sortFr(a.className, b.className));

    const classes = (classesResult.data || [])
      .filter((c: any) => String(c.name).trim().toUpperCase() !== 'TEST')
      .sort((a: any, b: any) => sortFr(a.name, b.name));

    return NextResponse.json({
      schoolYear: year.label,
      total: members.length,
      byClass,
      members,
      classes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de chargement.' },
      { status: 500 }
    );
  }
}

/*
 * Familles des années précédentes correspondant au nom saisi,
 * avec leurs enfants et la classe de l'époque.
 */
async function searchPreviousFamilies(
  admin: Admin,
  rawQuery: string,
  activeYearId: string | null
) {
  // Caractères réservés de la syntaxe de recherche retirés.
  const query = rawQuery.replace(/[,()%*\\]/g, ' ').trim();

  if (query.length < 2) return [];

  const terms = query.split(/\s+/).filter(Boolean).slice(0, 3);
  const filter = terms
    .flatMap((t) => [`last_name.ilike.%${t}%`, `first_name.ilike.%${t}%`])
    .join(',');

  const { data: adherents, error } = await admin
    .from('gipe_adherents')
    .select('id,last_name,first_name,address,phone,email')
    .or(filter)
    .limit(30);

  if (error) throw new Error(error.message);
  if (!adherents || adherents.length === 0) return [];

  const ids = adherents.map((a) => a.id);

  const [membershipsResult, yearsResult] = await Promise.all([
    admin
      .from('gipe_memberships')
      .select(`
        id,
        adherent_id,
        school_year_id,
        created_at,
        gipe_membership_children (
          gipe_children ( id, last_name, first_name ),
          classes ( name )
        )
      `)
      .in('adherent_id', ids),
    admin.from('school_years').select('id,label'),
  ]);

  if (membershipsResult.error) throw new Error(membershipsResult.error.message);

  const yearLabel = new Map((yearsResult.data || []).map((y: any) => [y.id, y.label]));
  const memberships = (membershipsResult.data || []) as any[];

  return adherents
    .map((adherent) => {
      const own = memberships.filter((m) => m.adherent_id === adherent.id);
      const alreadyMember = own.some((m) => m.school_year_id === activeYearId);
      const last = own
        .filter((m) => m.school_year_id !== activeYearId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];

      if (!last) return null;

      // Tous les termes saisis doivent correspondre (nom et/ou prénom).
      const haystack = `${adherent.last_name} ${adherent.first_name}`.toLowerCase();
      if (!terms.every((t) => haystack.includes(t.toLowerCase()))) return null;

      return {
        adherentId: adherent.id,
        lastName: adherent.last_name || '',
        firstName: adherent.first_name || '',
        address: adherent.address || '',
        phone: adherent.phone || '',
        email: adherent.email || '',
        lastYear: yearLabel.get(last.school_year_id) || '',
        alreadyMember,
        children: (last.gipe_membership_children || []).map((link: any) => {
          const child = one<any>(link.gipe_children) || {};
          return {
            id: child.id,
            lastName: child.last_name || '',
            firstName: child.first_name || '',
            previousClass: one<any>(link.classes)?.name || '',
          };
        }),
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

/* ---------------------------------------------------------
 * POST (création) / PUT (modification)
 * --------------------------------------------------------- */

async function save(request: Request, mode: 'create' | 'update') {
  const auth = await requireMembersAccess();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const body = (await request.json().catch(() => null)) as any;

  if (!body) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const lastName = String(body.lastName || '').trim();
  const firstName = String(body.firstName || '').trim();
  const email = String(body.email || '').trim();
  const council = body.councilParticipation || 'no';
  const paymentMethod = body.paymentMethod || '';
  const chequeNumber = String(body.chequeNumber || '').trim();

  if (mode === 'update' && !body.id) {
    return NextResponse.json({ error: 'Adhérent introuvable.' }, { status: 400 });
  }

  if (!lastName || !firstName) {
    return NextResponse.json(
      { error: 'Le nom et le prénom sont obligatoires.' },
      { status: 400 }
    );
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: 'L’adresse e-mail semble mal écrite (exemple : prenom.nom@gmail.com).' },
      { status: 400 }
    );
  }

  if (!COUNCIL_VALUES.includes(council)) {
    return NextResponse.json(
      { error: 'Choix de participation aux conseils invalide.' },
      { status: 400 }
    );
  }

  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ error: 'Mode de paiement invalide.' }, { status: 400 });
  }

  if (chequeNumber && paymentMethod !== 'cheque') {
    return NextResponse.json(
      { error: 'Le numéro de chèque nécessite un paiement par chèque.' },
      { status: 400 }
    );
  }

  let amount: number | null = null;

  if (body.amount !== '' && body.amount !== null && body.amount !== undefined) {
    amount = Number(String(body.amount).replace(',', '.'));

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Le montant est invalide.' }, { status: 400 });
    }

    amount = Math.round(amount * 100) / 100;
  }

  if (body.paymentReceived && !(amount && amount > 0)) {
    return NextResponse.json(
      { error: 'Indique le montant de la cotisation reçue.' },
      { status: 400 }
    );
  }

  const payload = {
    membershipId: mode === 'update' ? String(body.id) : null,
    adherentId: mode === 'create' && body.adherentId ? String(body.adherentId) : null,
    lastName,
    firstName,
    address: body.address || '',
    phone: body.phone || '',
    email,
    renewal: Boolean(body.renewal),
    councilParticipation: council,
    boardMember: Boolean(body.boardMember),
    caMember: Boolean(body.caMember),
    paymentReceived: Boolean(body.paymentReceived),
    paymentDate: body.paymentDate || null,
    paymentMethod: paymentMethod || null,
    chequeNumber: chequeNumber || null,
    amount,
    allowSharedChildren: Boolean(body.allowSharedChildren),
    children: (Array.isArray(body.children) ? body.children : []).map((c: any) => ({
      id: c.id || null,
      lastName: String(c.lastName || '').trim(),
      firstName: String(c.firstName || '').trim(),
      classId: c.classId || null,
    })),
  };

  const { data, error } = await admin.rpc('gipe_save_membership', {
    p_payload: payload,
  });

  if (error) {
    const message = String(error.message || '');

    if (message.startsWith('DUPLICATE:')) {
      return NextResponse.json(
        { duplicate: true, error: message.replace('DUPLICATE:', '').trim() },
        { status: 409 }
      );
    }

    if (message.startsWith('SHARED_CHILD:')) {
      return NextResponse.json(
        { sharedChild: true, error: message.replace('SHARED_CHILD:', '').trim() },
        { status: 409 }
      );
    }

    if (message.startsWith('INVALID:')) {
      return NextResponse.json(
        { error: message.replace('INVALID:', '').trim() },
        { status: 400 }
      );
    }

    if (message.includes('gipe_save_membership')) {
      return NextResponse.json(
        {
          error:
            'La mise à jour de la base de données n’a pas encore été faite (fonction gipe_save_membership absente). Lance la commande SQL « Adhérents v2 » dans Supabase.',
        },
        { status: 500 }
      );
    }

    console.error('Erreur enregistrement adhésion:', error);

    return NextResponse.json(
      {
        error: `L’adhésion n’a pas été enregistrée (rien n’a été modifié) : ${message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, ...(data as object) },
    { status: mode === 'create' ? 201 : 200 }
  );
}

export async function POST(request: Request) {
  return save(request, 'create');
}

export async function PUT(request: Request) {
  return save(request, 'update');
}
