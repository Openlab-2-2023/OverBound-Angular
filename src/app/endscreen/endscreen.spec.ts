import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Endscreen } from './endscreen';

describe('Endscreen', () => {
  let component: Endscreen;
  let fixture: ComponentFixture<Endscreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Endscreen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Endscreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
