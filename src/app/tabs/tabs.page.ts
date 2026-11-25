// src/app/tabs/tabs.page.ts
import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { IonTabs, IonTabBar, IonTabButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { person, location, home } from 'ionicons/icons';

interface TabDef {
  value: 'inicio' | 'centros' | 'perfil';
  label: string;
  icon: string;
  href: string;
  /** true cuando la página de esta pestaña tiene fondo oscuro/degradado
   *  azul (p. ej. Perfil), para que la etiqueta activa cambie a blanco
   *  y siga siendo legible sobre el cristal (que ahí se ve azulado). */
  darkBg: boolean;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, IonTabs, IonTabBar, IonTabButton, IonIcon],
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage {
  /** Dimensiones de la barra (px), deben coincidir con el SCSS: ambas
   *  definen el mismo sistema de coordenadas que usa el recorte (clip-path). */
  private readonly barWidth = 300;
  private readonly barHeight = 74;

  readonly tabs: TabDef[] = [
    { value: 'inicio', label: 'Inicio', icon: 'home', href: '/tabs/inicio', darkBg: false },
    { value: 'centros', label: 'Centros', icon: 'location', href: '/tabs/centros', darkBg: false },
    { value: 'perfil', label: 'Perfil', icon: 'person', href: '/tabs/perfil', darkBg: false },
  ];

  /** Índice de la pestaña activa, derivado de la URL actual y actualizado
   *  en cada navegación para poder animar la burbuja y el recorte. */
  activeIndex = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.resolveIndex(this.router.url)),
      startWith(this.resolveIndex(this.router.url)),
    ),
    { initialValue: this.resolveIndex(this.router.url) },
  );

  /** Forma de la barra (píldora con muesca curva bajo la pestaña activa),
   *  recalculada con transición suave de "clip-path" cada vez que cambia. */
  barClipPath = computed(() => `path('${this.buildNotchPath(this.activeIndex())}')`);

  constructor(private router: Router) {
    addIcons({ person, location, home });
  }

  private resolveIndex(url: string): number {
    const idx = this.tabs.findIndex((t) => url.includes(`/${t.value}`));
    return idx === -1 ? 0 : idx;
  }

  private buildNotchPath(index: number): string {
    const W = this.barWidth;
    const H = this.barHeight;
    // Esquinas ligeramente menos redondeadas que un stadium perfecto:
    // dejan espacio suficiente para que la muesca de las pestañas de
    // los extremos no choque contra la curva de la esquina.
    const r = 28;
    const segment = W / this.tabs.length;
    const cx = (index + 0.5) * segment;

    // El "ala" de la muesca (mitad de su ancho) se limita según el
    // espacio disponible a cada lado, así la curva nunca invade la
    // esquina redondeada -antes causaba la forma achatada/asimétrica-
    // y de paso queda más separada de la burbuja.
    const desiredWing = 24;
    const clearance = 6;
    const wing = Math.max(
      14,
      Math.min(desiredWing, cx - r - clearance, W - r - cx - clearance),
    );
    const notchR = wing / 1.35;
    const dipDepth = notchR * 0.55; // muesca suave acorde a la burbuja más cercana al label

    const round = (n: number) => Math.round(n * 100) / 100;

    return [
      `M ${round(r)} 0`,
      `L ${round(cx - wing)} 0`,
      `C ${round(cx - wing * 0.55)} 0, ${round(cx - notchR * 1.05)} ${round(dipDepth)}, ${round(cx)} ${round(dipDepth)}`,
      `C ${round(cx + notchR * 1.05)} ${round(dipDepth)}, ${round(cx + wing * 0.55)} 0, ${round(cx + wing)} 0`,
      `L ${round(W - r)} 0`,
      `A ${round(r)} ${round(r)} 0 0 1 ${round(W)} ${round(r)}`,
      `L ${round(W)} ${round(H - r)}`,
      `A ${round(r)} ${round(r)} 0 0 1 ${round(W - r)} ${round(H)}`,
      `L ${round(r)} ${round(H)}`,
      `A ${round(r)} ${round(r)} 0 0 1 0 ${round(H - r)}`,
      `L 0 ${round(r)}`,
      `A ${round(r)} ${round(r)} 0 0 1 ${round(r)} 0`,
      'Z',
    ].join(' ');
  }
}
