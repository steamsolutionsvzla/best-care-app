import { Component, Input, Output, EventEmitter, forwardRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonItem, IonIcon, IonLabel, IonModal, IonDatetime } from '@ionic/angular';

let nextDatePickerId = 0;

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, IonItem, IonIcon, IonLabel, IonModal, IonDatetime],
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  @ViewChild('modal') modal?: IonModal;

  @Input() label: string = 'Fecha de la cita';
  @Input() placeholder: string = 'Seleccionar fecha';
  @Input() icon: string = 'calendar-outline';
  @Input() iconColor: string = 'primary';
  @Input() isDateEnabled?: (dateIsoString: string) => boolean;
  @Input() min?: string;
  @Input() max?: string;
  @Input() presentation: 'date' | 'date-time' | 'time' | 'month' | 'year' = 'date';
  @Input() locale: string = 'es-ES';
  @Input() doneText: string = 'Aceptar';
  @Input() cancelText: string = 'Cancelar';
  @Input() showDefaultButtons: boolean = true;
  @Input() modalMode: 'md' | 'ios' = 'md';
  @Input() disabled: boolean = false;
  @Input() id: string = `custom-date-picker-${++nextDatePickerId}`;

  @Output() dateChange = new EventEmitter<string>();
  @Output() ionChange = new EventEmitter<any>();

  innerValue: string = '';

  onChange: any = () => {};
  onTouched: any = () => {};

  get currentValue(): string {
    return this.innerValue || '';
  }

  get datetimeValue(): string | null {
    return this.currentValue || null;
  }

  get displayValue(): string {
    const val = this.currentValue;
    if (!val) return '';
    if (this.presentation === 'date' && typeof val === 'string' && val.includes('T')) {
      return val.split('T')[0];
    }
    return val;
  }

  writeValue(val: any): void {
    this.innerValue = val || '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onDateChange(event: any, modal: any) {
    const rawValue = event?.detail?.value;
    if (!rawValue) return;

    const formattedDate =
      this.presentation === 'date' && typeof rawValue === 'string'
        ? rawValue.split('T')[0]
        : rawValue;

    this.innerValue = formattedDate;
    this.onChange(formattedDate);
    this.onTouched();

    this.dateChange.emit(formattedDate);
    this.ionChange.emit(event);

    modal.dismiss();
  }

  open() {
    this.modal?.present();
  }

  close() {
    this.modal?.dismiss();
  }
}
