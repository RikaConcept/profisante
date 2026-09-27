<?php
/**
 * Caisse de la Palmeraie — backend minimal pour hébergement mutualisé (PHP ≥ 7.4).
 *
 *   GET  api.php               → { state, version }   (le code trésorier n'est jamais renvoyé)
 *   POST api.php?action=verify → 200 si l'en-tête X-Pin est le code trésorier, sinon 401
 *   POST api.php?action=save   → enregistre l'état JSON envoyé (X-Pin requis,
 *                                If-Match: version pour éviter d'écraser une saisie concurrente)
 *   POST api.php?action=declare→ un membre annonce un paiement (sans code) ;
 *                                ajouté à `declarations` avec le statut « en_attente »
 *
 * `version` = empreinte de l'état SANS les déclarations (les déclarations
 * des membres n'invalident donc pas la saisie du trésorier) ; `stamp` =
 * empreinte complète, pour rafraîchir l'affichage.
 *
 * Les données vivent dans data/state.json à côté de ce fichier ; le dossier data/
 * est interdit d'accès direct (data/.htaccess). Après 5 codes faux, l'adresse IP
 * est bloquée 10 minutes.
 */
declare(strict_types=1);

const PIN_INITIAL = '1234';          // utilisé uniquement tant qu'aucune caisse n'a été enregistrée
const TAILLE_MAX = 4 * 1024 * 1024;  // 4 Mo

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$dossier = __DIR__ . '/data';
$fichier = $dossier . '/state.json';
$fichierTentatives = $dossier . '/attempts.json';

if (!is_dir($dossier)) {
    @mkdir($dossier, 0750, true);
}
if (!file_exists($dossier . '/.htaccess')) {
    @file_put_contents($dossier . '/.htaccess', "Require all denied\nDeny from all\n");
}

function repondre(int $code, array $corps): void
{
    http_response_code($code);
    echo json_encode($corps, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function lireJson(string $chemin): ?array
{
    if (!is_file($chemin)) {
        return null;
    }
    $j = json_decode((string) file_get_contents($chemin), true);
    return is_array($j) ? $j : null;
}

function ecrireJson(string $chemin, array $donnees): void
{
    $tmp = $chemin . '.tmp';
    if (file_put_contents($tmp, json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        repondre(500, ['erreur' => 'ecriture', 'message' => 'Impossible d\'écrire dans data/. Vérifiez les droits du dossier.']);
    }
    rename($tmp, $chemin);
}

function versionDe(?array $etat): string
{
    if ($etat === null) {
        return 'vide';
    }
    $copie = $etat;
    unset($copie['declarations']);
    return hash('sha256', json_encode($copie));
}

function empreinteDe(?array $etat): string
{
    return $etat === null ? 'vide' : hash('sha256', json_encode($etat));
}

/** Déclarations par identifiant. */
function declarationsDe(?array $etat): array
{
    $out = [];
    foreach ((array) ($etat['declarations'] ?? []) as $d) {
        if (is_array($d) && isset($d['id']) && is_string($d['id'])) {
            $out[$d['id']] = $d;
        }
    }
    return $out;
}

function sansPin(array $etat): array
{
    if (isset($etat['settings']) && is_array($etat['settings'])) {
        $etat['settings']['pinTresorier'] = '';
    }
    return $etat;
}

function pinStocke(?array $etat): string
{
    $p = $etat['settings']['pinTresorier'] ?? '';
    return is_string($p) && $p !== '' ? $p : PIN_INITIAL;
}

function enTete(string $nom): string
{
    $cle = 'HTTP_' . strtoupper(str_replace('-', '_', $nom));
    if (isset($_SERVER[$cle])) {
        return trim((string) $_SERVER[$cle]);
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strcasecmp($k, $nom) === 0) {
                return trim((string) $v);
            }
        }
    }
    return '';
}

function adresse(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/** Vérifie le code et tient le compte des échecs par adresse IP. */
function verifierPin(string $pin, ?array $etat, string $fichierTentatives): bool
{
    $maintenant = time();
    $t = lireJson($fichierTentatives) ?? [];
    foreach ($t as $k => $v) {
        if ((int) ($v['jusqua'] ?? 0) < $maintenant && (int) ($v['dernier'] ?? 0) < $maintenant - 600) {
            unset($t[$k]);
        }
    }
    $ip = adresse();
    if (isset($t[$ip]) && (int) ($t[$ip]['jusqua'] ?? 0) > $maintenant) {
        repondre(423, ['erreur' => 'trop_de_tentatives', 'reessayer_dans' => (int) $t[$ip]['jusqua'] - $maintenant]);
    }
    $ok = $pin !== '' && hash_equals(pinStocke($etat), $pin);
    if ($ok) {
        unset($t[$ip]);
    } else {
        $n = (int) ($t[$ip]['n'] ?? 0) + 1;
        $t[$ip] = ['n' => $n >= 5 ? 0 : $n, 'dernier' => $maintenant, 'jusqua' => $n >= 5 ? $maintenant + 600 : 0];
    }
    @file_put_contents($fichierTentatives, json_encode($t), LOCK_EX);
    return $ok;
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string) ($_GET['action'] ?? '');
$etat = lireJson($fichier);

if ($methode === 'GET') {
    repondre(200, ['state' => $etat === null ? null : sansPin($etat), 'version' => versionDe($etat), 'stamp' => empreinteDe($etat)]);
}
if ($methode !== 'POST') {
    repondre(405, ['erreur' => 'methode']);
}

$pin = enTete('X-Pin');

if ($action === 'verify') {
    verifierPin($pin, $etat, $fichierTentatives)
        ? repondre(200, ['ok' => true])
        : repondre(401, ['erreur' => 'pin']);
}

if ($action === 'save') {
    if (!verifierPin($pin, $etat, $fichierTentatives)) {
        repondre(401, ['erreur' => 'pin']);
    }
    $attendu = enTete('If-Match');
    $courante = versionDe($etat);
    if ($attendu !== '' && $attendu !== $courante) {
        repondre(409, ['erreur' => 'conflit', 'state' => $etat === null ? null : sansPin($etat), 'version' => $courante, 'stamp' => empreinteDe($etat)]);
    }
    $brut = (string) file_get_contents('php://input');
    if (strlen($brut) > TAILLE_MAX) {
        repondre(413, ['erreur' => 'trop_gros']);
    }
    $corps = json_decode($brut, true);
    if (!is_array($corps) || !isset($corps['settings'], $corps['membres'], $corps['mouvements'])
        || !is_array($corps['settings']) || !is_array($corps['membres']) || !is_array($corps['mouvements'])) {
        repondre(400, ['erreur' => 'corps']);
    }
    $nouveauPin = trim((string) ($corps['settings']['pinTresorier'] ?? ''));
    $corps['settings']['pinTresorier'] = $nouveauPin !== '' ? $nouveauPin : pinStocke($etat);
    $corps['version'] = 1;
    // Déclarations arrivées entre le chargement de la page et cet enregistrement : conservées.
    $duClient = declarationsDe($corps);
    foreach (declarationsDe($etat) as $id => $d) {
        if (!isset($duClient[$id]) && ($d['statut'] ?? '') === 'en_attente') {
            $duClient[$id] = $d;
        }
    }
    $corps['declarations'] = array_values($duClient);
    ecrireJson($fichier, $corps);
    repondre(200, ['ok' => true, 'version' => versionDe($corps), 'stamp' => empreinteDe($corps), 'state' => sansPin($corps)]);
}

if ($action === 'declare') {
    if ($etat === null) {
        repondre(409, ['erreur' => 'vide', 'message' => 'La caisse n\'a pas encore été initialisée par le trésorier.']);
    }
    // Limite : 10 déclarations par adresse IP et par heure.
    $q = lireJson($dossier . '/declare-rate.json') ?? [];
    $ip = adresse();
    $recentes = array_values(array_filter((array) ($q[$ip] ?? []), fn($t) => (int) $t > time() - 3600));
    if (count($recentes) >= 10) {
        repondre(429, ['erreur' => 'trop']);
    }
    $brut = (string) file_get_contents('php://input');
    if (strlen($brut) > 4096) {
        repondre(413, ['erreur' => 'trop_gros']);
    }
    $d = json_decode($brut, true);
    $membreId = is_array($d) ? (string) ($d['membreId'] ?? '') : '';
    $montant = is_array($d) ? (int) ($d['montant'] ?? 0) : 0;
    $moyen = is_array($d) ? trim((string) ($d['moyen'] ?? '')) : '';
    $mois = is_array($d) ? (string) ($d['mois'] ?? '') : '';
    $note = is_array($d) ? trim((string) ($d['note'] ?? '')) : '';
    $membreOk = false;
    foreach ((array) ($etat['membres'] ?? []) as $m) {
        if (is_array($m) && ($m['id'] ?? '') === $membreId && !empty($m['actif'])) {
            $membreOk = true;
        }
    }
    if (!$membreOk || $montant <= 0 || $montant > 100000000 || $moyen === '' || !preg_match('/^\d{4}-\d{2}$/', $mois)) {
        repondre(400, ['erreur' => 'corps', 'message' => 'Déclaration incomplète.']);
    }
    $enAttente = count(array_filter(declarationsDe($etat), fn($x) => ($x['statut'] ?? '') === 'en_attente'));
    if ($enAttente >= 200) {
        repondre(409, ['erreur' => 'plein', 'message' => 'Trop de déclarations en attente : le trésorier doit d\'abord les traiter.']);
    }
    $etat['declarations'] = array_values(declarationsDe($etat));
    $etat['declarations'][] = [
        'id' => 'd-' . bin2hex(random_bytes(6)),
        'membreId' => $membreId,
        'montant' => $montant,
        'moyen' => mb_substr($moyen, 0, 40),
        'mois' => $mois,
        'date' => date('Y-m-d'),
        'note' => $note !== '' ? mb_substr($note, 0, 200) : null,
        'statut' => 'en_attente',
    ];
    ecrireJson($fichier, $etat);
    $recentes[] = time();
    $q[$ip] = $recentes;
    @file_put_contents($dossier . '/declare-rate.json', json_encode($q), LOCK_EX);
    repondre(200, ['ok' => true, 'stamp' => empreinteDe($etat), 'state' => sansPin($etat)]);
}

repondre(404, ['erreur' => 'action']);
