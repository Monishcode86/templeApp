import { Injectable, signal, computed, Pipe, PipeTransform } from '@angular/core';

export type LanguageCode = 'en' | 'es' | 'fr';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  flag: string;
}

const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Navigation & Layout
    APP_TITLE: 'Node24 Admin',
    NAV_DASHBOARD: 'Dashboard',
    NAV_CONFIGURATION: 'Configuration',
    NAV_USERS: 'User Management',
    NAV_PLANTS: 'Plant Configuration',
    NAV_SHIFTS: 'Shift Configuration',
    NAV_SYSTEM: 'System Health',
    NAV_LOGOUT: 'Logout',
    NAV_PROFILE: 'Profile',
    THEME_DARK: 'Dark Mode',
    THEME_LIGHT: 'Light Mode',
    STATUS_ONLINE: 'API Online',
    STATUS_OFFLINE: 'API Offline',
    FULLSCREEN_EXPAND: 'Expand Fullscreen',
    FULLSCREEN_DESPAND: 'Exit Fullscreen',
    
    // Auth & Login
    LOGIN_TITLE: 'Welcome Back',
    LOGIN_SUBTITLE: 'Sign in to access your administrative dashboard',
    EMAIL_LABEL: 'Email Address',
    PASSWORD_LABEL: 'Password',
    EMAIL_PLACEHOLDER: 'admin@gmail.com',
    PASSWORD_PLACEHOLDER: '••••••••',
    LOGIN_BUTTON: 'Sign In',
    LOGGING_IN: 'Authenticating...',
    REMEMBER_ME: 'Remember credentials',
    FORGOT_PASSWORD: 'Forgot password?',

    // Dashboard
    DASHBOARD_HEADING: 'Operational Overview',
    DASHBOARD_SUBHEADING: 'Real-time metrics, system performance, and active sessions',
    TOTAL_USERS: 'Total Registered Users',
    SYSTEM_UPTIME: 'System Uptime',
    SERVER_ENVIRONMENT: 'Server Environment',
    DATABASE_STATUS: 'Database Connection',
    RECENT_USERS: 'Recent Users',
    QUICK_ACTIONS: 'Quick Actions',
    ADD_USER_QUICK: 'Add New User',
    VIEW_LOGS_QUICK: 'View API Logs',

    // User Management
    USERS_HEADING: 'User Management',
    USERS_SUBHEADING: 'Manage, filter, create, and update application users',
    ADD_USER_BTN: 'New User',
    SEARCH_PLACEHOLDER: 'Search by name, email, employee ID or plant...',
    COL_USERNAME: 'Username',
    COL_EMAIL: 'Email',
    COL_EMPLOYEE_ID: 'Employee ID',
    COL_PLANT: 'Plant',
    SELECT_PLANT: '-- Select Plant --',
    UPLOAD_AVATAR: 'Upload Photo',
    CHANGE_AVATAR: 'Change Photo',
    REMOVE_AVATAR: 'Remove Photo',
    EMPLOYEE_ID_PLACEHOLDER: 'e.g. EMP-101',
    COL_ROLE: 'Role',
    COL_ACTIONS: 'Actions',
    ROLE_ADMIN: 'Admin',
    ROLE_USER: 'User',
    EDIT: 'Edit',
    DELETE: 'Delete',
    CONFIRM_DELETE_TITLE: 'Confirm Deletion',
    CONFIRM_DELETE_MSG: 'Are you sure you want to delete this user? This action cannot be undone.',
    SAVE: 'Save Changes',
    CANCEL: 'Cancel',
    CREATE: 'Create User',
    NO_USERS_FOUND: 'No users match your search criteria.',
    CANNOT_DELETE_ADMIN: 'Admin users cannot be deleted.',
    IDENTIFIER_LABEL: 'Email or Employee ID',
    IDENTIFIER_PLACEHOLDER: 'admin@gmail.com or EMP-101',

    // Plant Management
    PLANTS_HEADING: 'Plant Configuration',
    PLANTS_SUBHEADING: 'Configure manufacturing units, assembly hubs, and operational facilities',
    ADD_PLANT_BTN: 'New Plant',
    SEARCH_PLANTS_PLACEHOLDER: 'Search plants by ID, name, location, or pincode...',
    COL_PLANT_ID: 'Plant ID',
    COL_PLANT_NAME: 'Plant Name',
    COL_LOCATION: 'Location',
    COL_PINCODE: 'Pincode',
    COL_EMPLOYEES: 'Employees',
    NO_PLANTS_FOUND: 'No plants configured yet. Click "New Plant" to add your first plant.',
    EDIT_PLANT_TITLE: 'Edit Plant',
    CREATE_PLANT_TITLE: 'Configure New Plant',
    UPLOAD_PLANT_IMG: 'Upload Plant Image',
    CHANGE_PLANT_IMG: 'Change Image',
    REMOVE_PLANT_IMG: 'Remove Image',
    LABEL_PLANT_ID: 'Plant ID',
    LABEL_PLANT_NAME: 'Plant Name',
    LABEL_LOCATION: 'Location',
    LABEL_PINCODE: 'Pincode / Postal Code',
    LABEL_NO_OF_EMPLOYEES: 'No. of Employees (Optional)',
    DELETE_PLANT_TITLE: 'Delete Plant',
    DELETE_PLANT_CONFIRM: 'Are you sure you want to delete this plant?',
    CONFIRM_DELETE_BTN: 'Confirm Delete'
  },
  es: {
    // Navigation & Layout
    APP_TITLE: 'Panel Node24',
    NAV_DASHBOARD: 'Panel Principal',
    NAV_CONFIGURATION: 'Configuración',
    NAV_USERS: 'Usuarios',
    NAV_PLANTS: 'Configuración de Plantas',
    NAV_SHIFTS: 'Configuración de Turnos',
    NAV_SYSTEM: 'Estado del Sistema',
    NAV_LOGOUT: 'Cerrar Sesión',
    NAV_PROFILE: 'Perfil',
    THEME_DARK: 'Modo Oscuro',
    THEME_LIGHT: 'Modo Claro',
    STATUS_ONLINE: 'API En línea',
    STATUS_OFFLINE: 'API Desconectada',
    FULLSCREEN_EXPAND: 'Expandir Pantalla Completa',
    FULLSCREEN_DESPAND: 'Restaurar Pantalla',
    
    // Auth & Login
    LOGIN_TITLE: 'Bienvenido de nuevo',
    LOGIN_SUBTITLE: 'Inicie sesión para acceder a su panel de administración',
    EMAIL_LABEL: 'Correo Electrónico',
    PASSWORD_LABEL: 'Contraseña',
    EMAIL_PLACEHOLDER: 'admin@gmail.com',
    PASSWORD_PLACEHOLDER: '••••••••',
    LOGIN_BUTTON: 'Iniciar Sesión',
    LOGGING_IN: 'Autenticando...',
    REMEMBER_ME: 'Recordarme',
    FORGOT_PASSWORD: '¿Olvidó la contraseña?',
    IDENTIFIER_LABEL: 'Correo o ID de Empleado',
    IDENTIFIER_PLACEHOLDER: 'admin@gmail.com o EMP-101',

    // Dashboard
    DASHBOARD_HEADING: 'Resumen Operativo',
    DASHBOARD_SUBHEADING: 'Métricas en tiempo real, rendimiento y sesiones activas',
    TOTAL_USERS: 'Total de Usuarios',
    SYSTEM_UPTIME: 'Tiempo de Actividad',
    SERVER_ENVIRONMENT: 'Entorno de Servidor',
    DATABASE_STATUS: 'Conexión de Base de Datos',
    RECENT_USERS: 'Usuarios Recientes',
    QUICK_ACTIONS: 'Acciones Rápidas',
    ADD_USER_QUICK: 'Agregar Usuario',
    VIEW_LOGS_QUICK: 'Ver Registros API',

    // User Management
    USERS_HEADING: 'Gestión de Usuarios',
    USERS_SUBHEADING: 'Administre, filtre, cree y actualice usuarios',
    ADD_USER_BTN: 'Nuevo Usuario',
    SEARCH_PLACEHOLDER: 'Buscar por nombre, correo, ID o planta...',
    COL_USERNAME: 'Usuario',
    COL_EMAIL: 'Correo',
    COL_EMPLOYEE_ID: 'ID de Empleado',
    COL_PLANT: 'Planta',
    SELECT_PLANT: '-- Seleccionar Planta --',
    UPLOAD_AVATAR: 'Subir Foto',
    CHANGE_AVATAR: 'Cambiar Foto',
    REMOVE_AVATAR: 'Eliminar Foto',
    EMPLOYEE_ID_PLACEHOLDER: 'ej. EMP-101',
    COL_ROLE: 'Rol',
    COL_ACTIONS: 'Acciones',
    ROLE_ADMIN: 'Administrador',
    ROLE_USER: 'Usuario',
    EDIT: 'Editar',
    DELETE: 'Eliminar',
    CONFIRM_DELETE_TITLE: 'Confirmar Eliminación',
    CONFIRM_DELETE_MSG: '¿Está seguro de que desea eliminar este usuario?',
    SAVE: 'Guardar Cambios',
    CANCEL: 'Cancelar',
    CREATE: 'Crear Usuario',
    NO_USERS_FOUND: 'No se encontraron usuarios.',
    CANNOT_DELETE_ADMIN: 'Las cuentas de administrador no se pueden eliminar.',

    // Plant Management
    PLANTS_HEADING: 'Configuración de Plantas',
    PLANTS_SUBHEADING: 'Configure unidades de manufactura, centros de ensamblaje e instalaciones',
    ADD_PLANT_BTN: 'Nueva Planta',
    SEARCH_PLANTS_PLACEHOLDER: 'Buscar plantas por ID, nombre, ubicación o código postal...',
    COL_PLANT_ID: 'ID de Planta',
    COL_PLANT_NAME: 'Nombre de Planta',
    COL_LOCATION: 'Ubicación',
    COL_PINCODE: 'Código Postal',
    COL_EMPLOYEES: 'Empleados',
    NO_PLANTS_FOUND: 'No hay plantas configuradas. Haga clic en "Nueva Planta" para agregar.',
    EDIT_PLANT_TITLE: 'Editar Planta',
    CREATE_PLANT_TITLE: 'Configurar Nueva Planta',
    UPLOAD_PLANT_IMG: 'Subir Imagen de Planta',
    CHANGE_PLANT_IMG: 'Cambiar Imagen',
    REMOVE_PLANT_IMG: 'Eliminar Imagen',
    LABEL_PLANT_ID: 'ID de Planta',
    LABEL_PLANT_NAME: 'Nombre de Planta',
    LABEL_LOCATION: 'Ubicación',
    LABEL_PINCODE: 'Código Postal',
    LABEL_NO_OF_EMPLOYEES: 'Núm. de Empleados (Opcional)',
    DELETE_PLANT_TITLE: 'Eliminar Planta',
    DELETE_PLANT_CONFIRM: '¿Está seguro de que desea eliminar esta planta?',
    CONFIRM_DELETE_BTN: 'Confirmar Eliminación'
  },
  fr: {
    // Navigation & Layout
    APP_TITLE: 'Tableau Node24',
    NAV_DASHBOARD: 'Tableau de bord',
    NAV_CONFIGURATION: 'Configuration',
    NAV_USERS: 'Gestion Utilisateurs',
    NAV_PLANTS: 'Configuration des Usines',
    NAV_SHIFTS: 'Configuration des Équipes',
    NAV_SYSTEM: 'État du Système',
    NAV_LOGOUT: 'Déconnexion',
    NAV_PROFILE: 'Profil',
    THEME_DARK: 'Mode Sombre',
    THEME_LIGHT: 'Mode Clair',
    STATUS_ONLINE: 'API En ligne',
    STATUS_OFFLINE: 'API Hors ligne',
    FULLSCREEN_EXPAND: 'Plein Écran',
    FULLSCREEN_DESPAND: 'Quitter Plein Écran',
    
    // Auth & Login
    LOGIN_TITLE: 'Bon retour',
    LOGIN_SUBTITLE: 'Connectez-vous pour accéder à votre panneau de gestion',
    EMAIL_LABEL: 'Adresse e-mail',
    PASSWORD_LABEL: 'Mot de passe',
    EMAIL_PLACEHOLDER: 'admin@gmail.com',
    PASSWORD_PLACEHOLDER: '••••••••',
    LOGIN_BUTTON: 'Se connecter',
    LOGGING_IN: 'Authentification...',
    REMEMBER_ME: 'Se souvenir de moi',
    FORGOT_PASSWORD: 'Mot de passe oublié?',
    IDENTIFIER_LABEL: 'Email ou ID Employé',
    IDENTIFIER_PLACEHOLDER: 'admin@gmail.com ou EMP-101',

    // Dashboard
    DASHBOARD_HEADING: 'Aperçu Opérationnel',
    DASHBOARD_SUBHEADING: 'Métriques en temps réel et performances du système',
    TOTAL_USERS: 'Utilisateurs Inscrits',
    SYSTEM_UPTIME: 'Temps de Fonctionnement',
    SERVER_ENVIRONMENT: 'Environnement Serveur',
    DATABASE_STATUS: 'Connexion Base de données',
    RECENT_USERS: 'Utilisateurs Récents',
    QUICK_ACTIONS: 'Actions Rapides',
    ADD_USER_QUICK: 'Ajouter un Utilisateur',
    VIEW_LOGS_QUICK: 'Consulter les Logs',

    // User Management
    USERS_HEADING: 'Gestion des Utilisateurs',
    USERS_SUBHEADING: 'Gérez, filtrez, créez et modifiez les utilisateurs',
    ADD_USER_BTN: 'Nouvel Utilisateur',
    SEARCH_PLACEHOLDER: 'Rechercher par nom, email, ID ou usine...',
    COL_USERNAME: 'Nom',
    COL_EMAIL: 'Email',
    COL_EMPLOYEE_ID: 'ID Employé',
    COL_PLANT: 'Usine',
    SELECT_PLANT: '-- Sélectionner Usine --',
    UPLOAD_AVATAR: 'Télécharger Photo',
    CHANGE_AVATAR: 'Changer Photo',
    REMOVE_AVATAR: 'Supprimer Photo',
    EMPLOYEE_ID_PLACEHOLDER: 'ex. EMP-101',
    COL_ROLE: 'Rôle',
    COL_ACTIONS: 'Actions',
    ROLE_ADMIN: 'Administrateur',
    ROLE_USER: 'Utilisateur',
    EDIT: 'Modifier',
    DELETE: 'Supprimer',
    CONFIRM_DELETE_TITLE: 'Confirmer la Suppression',
    CONFIRM_DELETE_MSG: 'Voulez-vous vraiment supprimer cet utilisateur?',
    SAVE: 'Enregistrer',
    CANCEL: 'Annuler',
    CREATE: 'Créer Utilisateur',
    NO_USERS_FOUND: 'Aucun utilisateur trouvé.',
    CANNOT_DELETE_ADMIN: 'Les comptes administrateur ne peuvent pas être supprimés.',

    // Plant Management
    PLANTS_HEADING: 'Configuration des Usines',
    PLANTS_SUBHEADING: 'Configurez les unités de fabrication, centres d’assemblage et installations',
    ADD_PLANT_BTN: 'Nouvelle Usine',
    SEARCH_PLANTS_PLACEHOLDER: 'Rechercher des usines par ID, nom, emplacement ou code postal...',
    COL_PLANT_ID: 'ID Usine',
    COL_PLANT_NAME: 'Nom Usine',
    COL_LOCATION: 'Emplacement',
    COL_PINCODE: 'Code Postal',
    COL_EMPLOYEES: 'Employés',
    NO_PLANTS_FOUND: 'Aucune usine configurée. Cliquez sur "Nouvelle Usine" pour en ajouter.',
    EDIT_PLANT_TITLE: 'Modifier l’Usine',
    CREATE_PLANT_TITLE: 'Configurer une Nouvelle Usine',
    UPLOAD_PLANT_IMG: 'Télécharger Image Usine',
    CHANGE_PLANT_IMG: 'Changer l’Image',
    REMOVE_PLANT_IMG: 'Supprimer l’Image',
    LABEL_PLANT_ID: 'ID Usine',
    LABEL_PLANT_NAME: 'Nom Usine',
    LABEL_LOCATION: 'Emplacement',
    LABEL_PINCODE: 'Code Postal',
    LABEL_NO_OF_EMPLOYEES: 'Nb. d’Employés (Optionnel)',
    DELETE_PLANT_TITLE: 'Supprimer l’Usine',
    DELETE_PLANT_CONFIRM: 'Êtes-vous sûr de vouloir supprimer cette usine?',
    CONFIRM_DELETE_BTN: 'Confirmer la Suppression'
  }
};

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly LANG_STORAGE_KEY = 'node24_lang';

  readonly availableLanguages: LanguageOption[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' }
  ];

  private currentLangSignal = signal<LanguageCode>(this.getInitialLanguage());
  readonly currentLanguage = computed(() => this.currentLangSignal());

  /**
   * Translate a key for the currently selected language
   */
  translate(key: string): string {
    const lang = this.currentLangSignal();
    const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return dictionary[key] || TRANSLATIONS.en[key] || key;
  }

  /**
   * Switch active language
   */
  setLanguage(lang: LanguageCode): void {
    this.currentLangSignal.set(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.LANG_STORAGE_KEY, lang);
    }
  }

  private getInitialLanguage(): LanguageCode {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.LANG_STORAGE_KEY) as LanguageCode;
      if (stored && (stored === 'en' || stored === 'es' || stored === 'fr')) {
        return stored;
      }
      const navLang = navigator.language?.slice(0, 2).toLowerCase();
      if (navLang === 'es' || navLang === 'fr') {
        return navLang as LanguageCode;
      }
    }
    return 'en';
  }
}

/**
 * Standalone Pipe for reactive template translations
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  constructor(private translationService: TranslationService) {}

  transform(key: string): string {
    return this.translationService.translate(key);
  }
}
